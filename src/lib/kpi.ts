import { db } from "@/lib/db";

export interface DateRange {
  start: Date;
  end: Date;
}

export function getPeriodRange(
  period: "today" | "week" | "month" | "term" | "year" | "custom",
  customStart?: string,
  customEnd?: string
): DateRange {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (period) {
    case "today":
      return { start: startOfDay, end: endOfDay };
    case "week": {
      // Week starts Sunday by default
      const day = startOfDay.getDay();
      const start = new Date(startOfDay);
      start.setDate(startOfDay.getDate() - day);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "term":
    case "year": {
      // Will be replaced by active school year/term — fallback to current month
      // The caller should override this with actual school year dates when available
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "custom": {
      if (customStart && customEnd) {
        return {
          start: new Date(customStart),
          end: new Date(customEnd + "T23:59:59"),
        };
      }
      return { start: startOfDay, end: endOfDay };
    }
  }
}

export async function getActiveSchoolYearRange(): Promise<DateRange | null> {
  const year = await db.schoolYear.findFirst({ where: { isActive: true } });
  if (!year) return null;
  return { start: year.startDate, end: year.endDate };
}

export async function getActiveTermRange(): Promise<DateRange | null> {
  const term = await db.schoolPeriod.findFirst({ where: { isActive: true } });
  if (!term) return getActiveSchoolYearRange();
  return { start: term.startDate, end: term.endDate };
}

// ============================================================
// KPI calculation functions
// ============================================================

const OVERDUE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"];
const COMPLETED_STATUSES = ["SUBMITTED", "COMPLETED", "APPROVED"];
const ACTIVE_ASSIGNMENT_STATUSES = ["ACTIVE"];

export interface DashboardMetrics {
  activeTeachers: number;
  assignmentsDue: number;
  workInProgress: number;
  workSubmittedOrCompleted: number;
  workApproved: number;
  workOverdue: number;
  workNeedsRevision: number;
  totalSubstitutionPeriods: number;
  unassignedSubstitutions: number;
  totalDepartures: number;
  pendingDepartureApprovals: number;
}

export async function getDashboardMetrics(range: DateRange): Promise<DashboardMetrics> {
  const [
    activeTeachers,
    assignmentsDue,
    workInProgress,
    workSubmittedOrCompleted,
    workApproved,
    workOverdue,
    workNeedsRevision,
    substitutions,
    unassignedSubs,
    totalDepartures,
    pendingDepartures,
  ] = await Promise.all([
    db.teacher.count({ where: { archivedAt: null, employmentStatus: "ACTIVE" } }),
    db.assignment.count({
      where: {
        assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
        dueDate: { gte: range.start, lte: range.end },
      },
    }),
    db.workRecord.count({
      where: {
        status: "IN_PROGRESS",
        assignment: { dueDate: { gte: range.start, lte: range.end } },
      },
    }),
    db.workRecord.count({
      where: {
        status: { in: ["SUBMITTED", "COMPLETED"] },
        assignment: { dueDate: { gte: range.start, lte: range.end } },
      },
    }),
    db.workRecord.count({
      where: {
        status: "APPROVED",
        assignment: { dueDate: { gte: range.start, lte: range.end } },
      },
    }),
    db.workRecord.count({
      where: {
        status: { in: OVERDUE_STATUSES },
        assignment: {
          dueDate: { lt: new Date(), gte: range.start, lte: range.end },
          assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
        },
      },
    }),
    db.workRecord.count({
      where: {
        status: "NEEDS_REVISION",
        assignment: { dueDate: { gte: range.start, lte: range.end } },
      },
    }),
    db.substitution.aggregate({
      _sum: { numberOfPeriods: true },
      where: { substitutionDate: { gte: range.start, lte: range.end } },
    }),
    db.substitution.count({
      where: {
        substitutionDate: { gte: range.start, lte: range.end },
        substituteTeacherId: null,
      },
    }),
    db.departure.count({
      where: { departureDate: { gte: range.start, lte: range.end } },
    }),
    db.departure.count({
      where: {
        approvalStatus: "PENDING",
        departureDate: { gte: range.start, lte: range.end },
      },
    }),
  ]);

  return {
    activeTeachers,
    assignmentsDue,
    workInProgress,
    workSubmittedOrCompleted,
    workApproved,
    workOverdue,
    workNeedsRevision,
    totalSubstitutionPeriods: substitutions._sum.numberOfPeriods || 0,
    unassignedSubstitutions: unassignedSubs,
    totalDepartures,
    pendingDepartureApprovals: pendingDepartures,
  };
}

// ============================================================
// Report KPIs (completion rate, approval rate, etc.)
// ============================================================

export interface ReportKPIs {
  totalEligible: number;
  completed: number;
  approved: number;
  overdue: number;
  needsRevision: number;
  inProgress: number;
  notStarted: number;
  completionRate: number | null; // null = insufficient data
  approvalRate: number | null;
  onTimeCompletionRate: number | null;
  overdueRate: number | null;
  avgCompletionHours: number | null;
}

export async function getReportKPIs(range: DateRange): Promise<ReportKPIs> {
  const records = await db.workRecord.findMany({
    where: {
      assignment: {
        dueDate: { gte: range.start, lte: range.end },
        assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
      status: { not: "CANCELLED" },
    },
    include: { assignment: true },
  });

  const total = records.length;
  if (total === 0) {
    return {
      totalEligible: 0,
      completed: 0,
      approved: 0,
      overdue: 0,
      needsRevision: 0,
      inProgress: 0,
      notStarted: 0,
      completionRate: null,
      approvalRate: null,
      onTimeCompletionRate: null,
      overdueRate: null,
      avgCompletionHours: null,
    };
  }

  const completed = records.filter((r) =>
    COMPLETED_STATUSES.includes(r.status)
  ).length;
  const approved = records.filter((r) => r.status === "APPROVED").length;
  const overdue = records.filter(
    (r) =>
      OVERDUE_STATUSES.includes(r.status) &&
      r.assignment.dueDate < new Date()
  ).length;
  const needsRevision = records.filter((r) => r.status === "NEEDS_REVISION").length;
  const inProgress = records.filter((r) => r.status === "IN_PROGRESS").length;
  const notStarted = records.filter((r) => r.status === "NOT_STARTED").length;

  const completionRate = (completed / total) * 100;
  const approvalRate = approved > 0 ? (approved / total) * 100 : null;
  const onTimeCompleted = records.filter(
    (r) =>
      COMPLETED_STATUSES.includes(r.status) &&
      r.completionDate &&
      r.completionDate <= r.assignment.dueDate
  ).length;
  const onTimeCompletionRate = (onTimeCompleted / total) * 100;
  const overdueRate = (overdue / total) * 100;

  // Average completion time (hours) — for records with completion_date
  const completedWithDates = records.filter(
    (r) => r.completionDate && COMPLETED_STATUSES.includes(r.status)
  );
  let avgCompletionHours: number | null = null;
  if (completedWithDates.length > 0) {
    const totalHours = completedWithDates.reduce((sum, r) => {
      const diff = (r.completionDate!.getTime() - r.assignment.assignedDate.getTime()) / (1000 * 60 * 60);
      return sum + Math.max(0, diff);
    }, 0);
    avgCompletionHours = totalHours / completedWithDates.length;
  }

  return {
    totalEligible: total,
    completed,
    approved,
    overdue,
    needsRevision,
    inProgress,
    notStarted,
    completionRate,
    approvalRate,
    onTimeCompletionRate,
    overdueRate,
    avgCompletionHours,
  };
}

// ============================================================
// Chart data builders
// ============================================================

export async function getWorkStatusDistribution(range: DateRange) {
  const records = await db.workRecord.findMany({
    where: {
      assignment: {
        dueDate: { gte: range.start, lte: range.end },
        assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
    },
    select: { status: true },
  });

  const statusLabels: Record<string, string> = {
    NOT_STARTED: "لم يبدأ",
    IN_PROGRESS: "قيد التنفيذ",
    SUBMITTED: "مُسلَّم",
    NEEDS_REVISION: "يحتاج تعديل",
    COMPLETED: "مكتمل",
    APPROVED: "معتمد",
    REJECTED: "مرفوض",
    CANCELLED: "ملغى",
  };

  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }

  return Object.entries(counts).map(([k, v]) => ({
    name: statusLabels[k] || k,
    value: v,
    key: k,
  }));
}

export async function getSubstitutionByTeacher(range: DateRange) {
  const subs = await db.substitution.findMany({
    where: {
      substitutionDate: { gte: range.start, lte: range.end },
      substituteTeacherId: { not: null },
    },
    include: { substituteTeacher: true },
  });

  const byTeacher: Record<string, { name: string; periods: number }> = {};
  for (const s of subs) {
    const id = s.substituteTeacherId!;
    const name = s.substituteTeacher?.fullName || "غير معروف";
    if (!byTeacher[id]) byTeacher[id] = { name, periods: 0 };
    byTeacher[id].periods += s.numberOfPeriods;
  }

  return Object.values(byTeacher).sort((a, b) => b.periods - a.periods);
}

export async function getOverdueByCategory(range: DateRange) {
  const records = await db.workRecord.findMany({
    where: {
      status: { in: OVERDUE_STATUSES },
      assignment: {
        dueDate: { lt: new Date(), gte: range.start, lte: range.end },
        assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
    },
    include: { assignment: { include: { workType: true } } },
  });

  const byType: Record<string, number> = {};
  for (const r of records) {
    const name = r.assignment.workType?.name || "غير مصنف";
    byType[name] = (byType[name] || 0) + 1;
  }

  return Object.entries(byType).map(([name, count]) => ({ name, count }));
}

export async function getMonthlyCompletionTrend(range: DateRange) {
  // Build monthly buckets within range, count completion vs total
  const records = await db.workRecord.findMany({
    where: {
      assignment: { dueDate: { gte: range.start, lte: range.end } },
    },
    include: { assignment: true },
  });

  const months: Record<string, { month: string; total: number; completed: number }> = {};
  for (const r of records) {
    const d = r.assignment.dueDate;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!months[key]) {
      const monthName = d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
      months[key] = { month: monthName, total: 0, completed: 0 };
    }
    months[key].total += 1;
    if (COMPLETED_STATUSES.includes(r.status)) {
      months[key].completed += 1;
    }
  }

  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

export async function getRequiredVsCompleted(range: DateRange) {
  const records = await db.workRecord.findMany({
    where: {
      assignment: {
        dueDate: { gte: range.start, lte: range.end },
        assignmentStatus: { in: ACTIVE_ASSIGNMENT_STATUSES },
      },
    },
    include: { assignment: true },
  });

  const required = records.length;
  const completed = records.filter((r) => COMPLETED_STATUSES.includes(r.status)).length;
  const approved = records.filter((r) => r.status === "APPROVED").length;
  const now = new Date();
  const overdue = records.filter(
    (r) => OVERDUE_STATUSES.includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()
  ).length;

  return [
    { name: "المطلوب", value: required },
    { name: "المكتمل", value: completed },
    { name: "المعتمد", value: approved },
    { name: "المتأخر", value: overdue },
  ];
}

// ============================================================
// Utility helpers for percentage formatting (used by reports)
// ============================================================

/**
 * Returns the percentage as a number, or null when the denominator is 0
 * (per the spec: "Avoid dividing by zero — return 'لا توجد بيانات كافية' when denominator is 0")
 */
export function safePct(numerator: number, denominator: number): number | null {
  if (!denominator || denominator === 0) return null;
  return (numerator / denominator) * 100;
}

/**
 * Formats a percentage value as an Arabic-localized string.
 * Returns "لا توجد بيانات كافية" when the value is null (insufficient data).
 */
export function formatPct(value: number | null): string {
  if (value === null || value === undefined) return "لا توجد بيانات كافية";
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(value)}٪`;
}
