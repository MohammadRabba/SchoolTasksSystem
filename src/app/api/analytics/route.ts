import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { resolvePeriod } from '@/lib/date-utils';

export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const kind = (url.searchParams.get('periodKind') || 'MONTH') as any;
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  let range: { start: Date; end: Date };
  if (start && end) {
    range = { start: new Date(start), end: new Date(end) };
  } else {
    range = resolvePeriod({ kind });
  }

  // 1. Bar: required / completed / approved / overdue per work type
  const records = await db.workRecord.findMany({
    where: {
      assignment: { dueDate: { gte: range.start, lte: range.end } },
      status: { notIn: ['CANCELLED'] },
    },
    include: { assignment: { select: { dueDate: true, workType: { select: { name: true } } } } },
  });
  const byWt = new Map<string, { required: number; completed: number; approved: number; overdue: number }>();
  const now = new Date();
  for (const r of records) {
    const n = r.assignment.workType.name;
    const e = byWt.get(n) ?? { required: 0, completed: 0, approved: 0, overdue: 0 };
    e.required++;
    if (r.status === 'COMPLETED' || r.status === 'APPROVED') e.completed++;
    if (r.status === 'APPROVED') e.approved++;
    if (!['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()) e.overdue++;
    byWt.set(n, e);
  }
  const barByWorkType = Array.from(byWt.entries()).map(([name, v]) => ({ name, ...v }));

  // 2. Line: monthly completion trend (across the year of range.end)
  const yearStart = new Date(range.end.getFullYear(), 0, 1);
  const yearEnd = new Date(range.end.getFullYear(), 11, 31, 23, 59, 59);
  const yearRecs = await db.workRecord.findMany({
    where: {
      assignment: { dueDate: { gte: yearStart, lte: yearEnd } },
      status: { notIn: ['CANCELLED'] },
    },
    include: { assignment: { select: { dueDate: true } } },
  });
  const monthMap = new Map<string, { total: number; completed: number }>();
  for (const r of yearRecs) {
    const ym = `${r.assignment.dueDate.getFullYear()}/${String(r.assignment.dueDate.getMonth() + 1).padStart(2, '0')}`;
    const e = monthMap.get(ym) ?? { total: 0, completed: 0 };
    e.total++;
    if (r.status === 'COMPLETED' || r.status === 'APPROVED') e.completed++;
    monthMap.set(ym, e);
  }
  const monthlyTrend = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ month: k, total: v.total, completed: v.completed, completionRate: v.total ? (v.completed / v.total) * 100 : 0 }));

  // 3. Bar: substitution periods by teacher
  const substs = await db.substitution.findMany({
    where: { substitutionDate: { gte: range.start, lte: range.end } },
    include: { substituteTeacher: { select: { fullName: true } } },
  });
  const substMap = new Map<string, number>();
  for (const s of substs) {
    const n = s.substituteTeacher?.fullName ?? 'غير مُعيّن';
    substMap.set(n, (substMap.get(n) ?? 0) + (s.numberOfPeriods || 1));
  }
  const substByTeacher = Array.from(substMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 4. Donut: work status distribution
  const statusCounts = new Map<string, number>();
  for (const r of records) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
  }
  const statusLabels: Record<string, string> = {
    NOT_STARTED: 'لم يبدأ',
    IN_PROGRESS: 'قيد التنفيذ',
    SUBMITTED: 'تم التسليم',
    NEEDS_REVISION: 'بحاجة لمراجعة',
    COMPLETED: 'مكتمل',
    APPROVED: 'معتمد',
    REJECTED: 'مرفوض',
    CANCELLED: 'ملغى',
  };
  const statusDistribution = Array.from(statusCounts.entries()).map(([k, v]) => ({
    name: statusLabels[k] ?? k,
    value: v,
    raw: k,
  }));

  // 5. Bar: overdue work by work type (category)
  const overdueByWt = new Map<string, number>();
  for (const r of records) {
    if (!['COMPLETED', 'APPROVED', 'CANCELLED', 'REJECTED'].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()) {
      const n = r.assignment.workType.name;
      overdueByWt.set(n, (overdueByWt.get(n) ?? 0) + 1);
    }
  }
  const overdueByCategory = Array.from(overdueByWt.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // 6. Monthly comparison chart for completion & approval rates
  const compMap = new Map<string, { total: number; completed: number; approved: number }>();
  for (const r of yearRecs) {
    const ym = `${r.assignment.dueDate.getFullYear()}/${String(r.assignment.dueDate.getMonth() + 1).padStart(2, '0')}`;
    const e = compMap.get(ym) ?? { total: 0, completed: 0, approved: 0 };
    e.total++;
    if (r.status === 'COMPLETED' || r.status === 'APPROVED') e.completed++;
    if (r.status === 'APPROVED') e.approved++;
    compMap.set(ym, e);
  }
  const monthlyComparison = Array.from(compMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({
      month: k,
      completionRate: v.total ? (v.completed / v.total) * 100 : 0,
      approvalRate: v.total ? (v.approved / v.total) * 100 : 0,
    }));

  return NextResponse.json({
    range,
    barByWorkType,
    monthlyTrend,
    substByTeacher,
    statusDistribution,
    overdueByCategory,
    monthlyComparison,
  });
}
