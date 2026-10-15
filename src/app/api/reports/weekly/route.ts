import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

/**
 * Weekly report contents:
 *  - Teachers with assignments
 *  - Total work records due
 *  - Completed/approved
 *  - In-progress
 *  - Overdue (with details)
 *  - Substitution totals & distribution
 *  - Departure summaries
 *  - Outstanding administrative actions
 */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const teacherId = url.searchParams.get('teacherId') || undefined;
  const schoolYearId = url.searchParams.get('schoolYearId') || undefined;

  let range: { start: Date; end: Date };
  if (start && end) {
    range = { start: new Date(start), end: new Date(end) };
  } else {
    const now = new Date();
    const s = new Date(now);
    s.setDate(now.getDate() - 6);
    range = { start: s, end: now };
  }

  const recordWhere: Record<string, unknown> = {
    assignment: {
      dueDate: { gte: range.start, lte: range.end },
      ...(schoolYearId ? { schoolYearId } : {}),
    },
    status: { notIn: ['CANCELLED'] },
    ...(teacherId ? { teacherId } : {}),
  };

  const records = await db.workRecord.findMany({
    where: recordWhere as any,
    include: {
      assignment: { select: { title: true, dueDate: true, workType: { select: { name: true } }, priority: true } },
      teacher: { select: { id: true, fullName: true } },
    },
  });

  const now = new Date();
  const completed = records.filter((r) => r.status === 'COMPLETED' || r.status === 'APPROVED');
  const approved = records.filter((r) => r.status === 'APPROVED');
  const inProgress = records.filter((r) => r.status === 'IN_PROGRESS' || r.status === 'SUBMITTED');
  const overdue = records.filter(
    (r) => !['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()
  );

  const teacherIds = new Set(records.map((r) => r.teacherId));
  const teachers = await db.teacher.findMany({
    where: { id: { in: Array.from(teacherIds) } },
    select: { id: true, fullName: true },
  });

  const substWhere: Record<string, unknown> = {
    substitutionDate: { gte: range.start, lte: range.end },
  };
  const substitutions = await db.substitution.findMany({
    where: substWhere as any,
    include: {
      originalTeacher: { select: { fullName: true } },
      substituteTeacher: { select: { fullName: true } },
    },
  });
  const totalSubstPeriods = substitutions.reduce((s, x) => s + (x.numberOfPeriods || 1), 0);
  const unassignedSubst = substitutions.filter((s) => !s.substituteTeacherId);

  const depWhere: Record<string, unknown> = {
    departureDate: { gte: range.start, lte: range.end },
    ...(teacherId ? { teacherId } : {}),
  };
  const departures = await db.departure.findMany({
    where: depWhere as any,
    include: { teacher: { select: { fullName: true } } },
  });
  const pendingDepartures = departures.filter((d) => d.approvalStatus === 'PENDING');

  const pendingApprovals = await db.workRecord.findMany({
    where: { status: 'SUBMITTED' },
    include: { assignment: { select: { title: true } }, teacher: { select: { fullName: true } } },
    take: 50,
  });

  return NextResponse.json({
    range,
    teachersWithAssignments: teachers.length,
    totalWorkRecords: records.length,
    completed: completed.length,
    approved: approved.length,
    inProgress: inProgress.length,
    overdue: overdue.length,
    overdueDetails: overdue.map((r) => ({
      id: r.id,
      teacher: r.teacher.fullName,
      assignmentTitle: r.assignment.title,
      workType: r.assignment.workType.name,
      dueDate: r.assignment.dueDate,
      status: r.status,
      priority: r.assignment.priority,
    })),
    substitutionTotals: {
      events: substitutions.length,
      periods: totalSubstPeriods,
      unassigned: unassignedSubst.length,
    },
    substitutionDistribution: substitutions,
    departureSummary: {
      events: departures.length,
      pending: pendingDepartures.length,
      affectedPeriods: departures.reduce((s, d) => s + (d.affectedPeriodCount || 0), 0),
    },
    outstandingActions: {
      pendingApprovals: pendingApprovals.length,
      pendingApprovalsList: pendingApprovals,
      pendingDepartures: pendingDepartures.length,
      unassignedSubstitutions: unassignedSubst.length,
    },
  });
}
