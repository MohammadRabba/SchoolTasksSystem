import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { resolvePeriod } from '@/lib/date-utils';
import { safePct, formatPct } from '@/lib/kpi';

/**
 * Term/Annual report:
 *  - Teacher-specific summaries
 *  - Monthly completion trends
 *  - Repeated delays by work type
 *  - Substitution totals & distribution
 *  - Departure statistics
 *  - Changes in completion & punctuality over time
 */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const mode = (url.searchParams.get('mode') as 'TERM' | 'YEAR') || 'YEAR';
  const schoolYearId = url.searchParams.get('schoolYearId') || undefined;

  let range: { start: Date; end: Date };
  if (start && end) {
    range = { start: new Date(start), end: new Date(end) };
  } else {
    let yearStart: string | undefined;
    let yearEnd: string | undefined;
    let termStart: string | undefined;
    let termEnd: string | undefined;
    if (mode === 'TERM' || mode === 'YEAR') {
      const activeYear = await db.schoolYear.findFirst({ where: { isActive: true } });
      if (activeYear) {
        yearStart = activeYear.startDate.toISOString();
        yearEnd = activeYear.endDate.toISOString();
        const activeTerm = await db.schoolPeriod.findFirst({
          where: { schoolYearId: activeYear.id, isActive: true },
        });
        if (activeTerm) {
          termStart = activeTerm.startDate.toISOString();
          termEnd = activeTerm.endDate.toISOString();
        }
      }
    }
    range = resolvePeriod({ kind: mode }, { termStart, termEnd, yearStart, yearEnd });
  }

  const baseWhere: Record<string, unknown> = {
    assignment: {
      dueDate: { gte: range.start, lte: range.end },
      ...(schoolYearId ? { schoolYearId } : {}),
    },
    status: { notIn: ['CANCELLED'] },
  };
  const records = await db.workRecord.findMany({
    where: baseWhere as any,
    include: {
      assignment: {
        select: {
          id: true,
          title: true,
          assignedDate: true,
          dueDate: true,
          workType: { select: { name: true } },
        },
      },
      teacher: { select: { id: true, fullName: true, specialization: true } },
      reviews: true,
    },
  });

  const now = new Date();
  // Teacher-specific summaries
  const teacherMap = new Map<string, {
    teacherId: string;
    name: string;
    total: number;
    completed: number;
    approved: number;
    overdue: number;
    onTime: number;
    revisionCount: number;
  }>();
  for (const r of records) {
    const t = teacherMap.get(r.teacherId) ?? {
      teacherId: r.teacherId,
      name: r.teacher.fullName,
      total: 0, completed: 0, approved: 0, overdue: 0, onTime: 0, revisionCount: 0,
    };
    t.total++;
    if (r.status === 'COMPLETED' || r.status === 'APPROVED') t.completed++;
    if (r.status === 'APPROVED') t.approved++;
    if (r.status === 'NEEDS_REVISION') t.revisionCount++;
    if (!['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()) t.overdue++;
    if ((r.status === 'COMPLETED' || r.status === 'APPROVED') && r.completionDate && r.completionDate.getTime() <= r.assignment.dueDate.getTime()) t.onTime++;
    teacherMap.set(r.teacherId, t);
  }
  const teachers = Array.from(teacherMap.values());

  // Monthly completion trends
  const monthsMap = new Map<string, { total: number; completed: number; approved: number; overdue: number }>();
  for (const r of records) {
    const ym = `${r.assignment.dueDate.getFullYear()}/${String(r.assignment.dueDate.getMonth() + 1).padStart(2, '0')}`;
    const m = monthsMap.get(ym) ?? { total: 0, completed: 0, approved: 0, overdue: 0 };
    m.total++;
    if (r.status === 'COMPLETED' || r.status === 'APPROVED') m.completed++;
    if (r.status === 'APPROVED') m.approved++;
    if (!['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()) m.overdue++;
    monthsMap.set(ym, m);
  }
  const monthlyTrend = Array.from(monthsMap.entries()).map(([k, v]) => ({
    month: k,
    total: v.total,
    completed: v.completed,
    approved: v.approved,
    overdue: v.overdue,
    completionRate: formatPct(safePct(v.completed, v.total)),
  }));

  // Repeated delays by work type
  const wtMap = new Map<string, { name: string; total: number; overdue: number; overdueRate: number | null }>();
  for (const r of records) {
    const wtName = r.assignment.workType.name;
    const wt = wtMap.get(wtName) ?? { name: wtName, total: 0, overdue: 0, overdueRate: null };
    wt.total++;
    if (!['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()) wt.overdue++;
    wtMap.set(wtName, wt);
  }
  const repeatedDelays = Array.from(wtMap.values())
    .map((w) => ({ ...w, overdueRate: safePct(w.overdue, w.total) }))
    .sort((a, b) => (b.overdueRate ?? 0) - (a.overdueRate ?? 0));

  // Substitutions
  const subst = await db.substitution.findMany({
    where: { substitutionDate: { gte: range.start, lte: range.end } },
    include: { substituteTeacher: { select: { fullName: true } } },
  });
  const substByTeacher = new Map<string, number>();
  let totalSubstPeriods = 0;
  for (const s of subst) {
    const name = s.substituteTeacher?.fullName ?? 'غير مُعيّن';
    substByTeacher.set(name, (substByTeacher.get(name) ?? 0) + (s.numberOfPeriods || 1));
    totalSubstPeriods += s.numberOfPeriods || 1;
  }

  // Departures
  const departures = await db.departure.findMany({
    where: { departureDate: { gte: range.start, lte: range.end } },
  });
  const depByType = new Map<string, number>();
  let affectedPeriods = 0, depDurationMins = 0;
  for (const d of departures) {
    depByType.set(d.departureType, (depByType.get(d.departureType) ?? 0) + 1);
    affectedPeriods += d.affectedPeriodCount || 0;
    if (d.returnTime) {
      const [dh, dm] = d.departureTime.split(':').map(Number);
      const [rh, rm] = d.returnTime.split(':').map(Number);
      const mins = (rh * 60 + rm) - (dh * 60 + dm);
      if (mins > 0) depDurationMins += mins;
    }
  }

  return NextResponse.json({
    range,
    mode,
    totalRecords: records.length,
    completed: records.filter((r) => r.status === 'COMPLETED' || r.status === 'APPROVED').length,
    approved: records.filter((r) => r.status === 'APPROVED').length,
    overdue: records.filter((r) => !['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()).length,
    teachers,
    monthlyTrend,
    repeatedDelays,
    substitutions: {
      total: subst.length,
      totalPeriods: totalSubstPeriods,
      distribution: Array.from(substByTeacher.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    },
    departures: {
      frequency: departures.length,
      affectedPeriods,
      totalDurationMins: depDurationMins,
      byType: Array.from(depByType.entries()).map(([type, count]) => ({ type, count })),
    },
  });
}
