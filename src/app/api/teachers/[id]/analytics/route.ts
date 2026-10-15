import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/teachers/[id]/analytics
 * Returns teacher-specific KPIs + recent records + chart data.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Teacher profile
    const teacher = await db.teacher.findUnique({
      where: { id },
      include: { classesAndSections: true },
    });

    if (!teacher) {
      return NextResponse.json({ error: "المعلم غير موجود" }, { status: 404 });
    }

    const now = new Date();

    // All work records for this teacher
    const workRecords = await db.workRecord.findMany({
      where: { teacherId: id },
      include: {
        assignment: {
          include: { workType: true, schoolYear: true, schoolPeriod: true },
        },
        reviews: { include: { administrator: { select: { name: true } } }, orderBy: { reviewedAt: "desc" } },
      },
      orderBy: { assignment: { dueDate: "desc" } },
      take: 200,
    });

    // Substitutions where this teacher is original OR substitute
    const substitutionsAsOriginal = await db.substitution.findMany({
      where: { originalTeacherId: id },
      orderBy: { substitutionDate: "desc" },
      take: 100,
    });
    const substitutionsAsSubstitute = await db.substitution.findMany({
      where: { substituteTeacherId: id },
      orderBy: { substitutionDate: "desc" },
      take: 100,
    });

    // Departures
    const departures = await db.departure.findMany({
      where: { teacherId: id },
      orderBy: { departureDate: "desc" },
      take: 100,
    });

    // ============================================================
    // KPIs
    // ============================================================
    const COMPLETED_STATUSES = ["SUBMITTED", "COMPLETED", "APPROVED"];
    const OVERDUE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"];

    const totalAssignments = workRecords.length;
    const completed = workRecords.filter((r) => COMPLETED_STATUSES.includes(r.status)).length;
    const approved = workRecords.filter((r) => r.status === "APPROVED").length;
    const overdue = workRecords.filter(
      (r) =>
        OVERDUE_STATUSES.includes(r.status) &&
        r.assignment.dueDate.getTime() < now.getTime() &&
        r.assignment.assignmentStatus === "ACTIVE"
    ).length;
    const inProgress = workRecords.filter((r) => r.status === "IN_PROGRESS").length;
    const notStarted = workRecords.filter((r) => r.status === "NOT_STARTED").length;
    const needsRevision = workRecords.filter((r) => r.status === "NEEDS_REVISION").length;
    const rejected = workRecords.filter((r) => r.status === "REJECTED").length;

    // On-time completion (records completed on or before due date)
    const onTimeCompleted = workRecords.filter(
      (r) =>
        COMPLETED_STATUSES.includes(r.status) &&
        r.completionDate &&
        r.completionDate.getTime() <= r.assignment.dueDate.getTime()
    ).length;

    // Average completion time (in hours) — for records with completion_date
    const completedWithDates = workRecords.filter(
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

    // Substitutions totals
    const totalSubstitutionsAsOriginal = substitutionsAsOriginal.length;
    const totalSubstitutionsAsSubstitute = substitutionsAsSubstitute.length;
    const totalSubstitutionPeriodsAsSubstitute = substitutionsAsSubstitute.reduce(
      (s, x) => s + (x.numberOfPeriods || 1),
      0
    );

    // Departures
    const totalDepartures = departures.length;
    const pendingDepartures = departures.filter((d) => d.approvalStatus === "PENDING").length;
    const approvedDepartures = departures.filter((d) => d.approvalStatus === "APPROVED").length;
    const totalAffectedPeriods = departures.reduce((s, d) => s + (d.affectedPeriodCount || 0), 0);

    // ============================================================
    // Chart data
    // ============================================================

    // Status distribution
    const statusCounts: Record<string, number> = {};
    for (const r of workRecords) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }
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
    const statusDistribution = Object.entries(statusCounts).map(([k, v]) => ({
      name: statusLabels[k] || k,
      value: v,
      key: k,
    }));

    // Monthly completion trend (last 12 months)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthsMap: Record<string, { month: string; total: number; completed: number }> = {};
    for (const r of workRecords) {
      const d = r.assignment.dueDate;
      if (d.getTime() < twelveMonthsAgo.getTime()) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthsMap[key]) {
        const monthName = d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
        monthsMap[key] = { month: monthName, total: 0, completed: 0 };
      }
      monthsMap[key].total += 1;
      if (COMPLETED_STATUSES.includes(r.status)) {
        monthsMap[key].completed += 1;
      }
    }
    const monthlyTrend = Object.values(monthsMap).sort((a, b) => a.month.localeCompare(b.month));

    // ============================================================
    // Response
    // ============================================================
    return NextResponse.json({
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        employeeNumber: teacher.employeeNumber,
        specialization: teacher.specialization,
        subjects: teacher.subjects,
        weeklyPeriodCount: teacher.weeklyPeriodCount,
        employmentStartDate: teacher.employmentStartDate,
        employmentStatus: teacher.employmentStatus,
        administrativeNotes: teacher.administrativeNotes,
        classesAndSections: teacher.classesAndSections,
      },
      kpis: {
        totalAssignments,
        completed,
        approved,
        overdue,
        inProgress,
        notStarted,
        needsRevision,
        rejected,
        onTimeCompleted,
        completionRate: totalAssignments ? (completed / totalAssignments) * 100 : null,
        approvalRate: totalAssignments ? (approved / totalAssignments) * 100 : null,
        onTimeRate: totalAssignments ? (onTimeCompleted / totalAssignments) * 100 : null,
        overdueRate: totalAssignments ? (overdue / totalAssignments) * 100 : null,
        avgCompletionHours,
      },
      substitutions: {
        asOriginal: totalSubstitutionsAsOriginal,
        asSubstitute: totalSubstitutionsAsSubstitute,
        totalPeriodsAsSubstitute: totalSubstitutionPeriodsAsSubstitute,
      },
      departures: {
        total: totalDepartures,
        pending: pendingDepartures,
        approved: approvedDepartures,
        totalAffectedPeriods,
      },
      charts: {
        statusDistribution,
        monthlyTrend,
      },
      recentRecords: workRecords.slice(0, 20).map((r) => ({
        id: r.id,
        title: r.assignment.title,
        assignmentId: r.assignmentId,
        workType: r.assignment.workType?.name,
        assignedDate: r.assignment.assignedDate,
        dueDate: r.assignment.dueDate,
        completionDate: r.completionDate,
        status: r.status,
        priority: r.assignment.priority,
        recurringAssignmentId: r.assignment.recurringAssignmentId,
      })),
      recentSubstitutions: [
        ...substitutionsAsOriginal.map((s) => ({
          ...s,
          role: "original" as const,
        })),
        ...substitutionsAsSubstitute.map((s) => ({
          ...s,
          role: "substitute" as const,
        })),
      ]
        .sort((a, b) => b.substitutionDate.getTime() - a.substitutionDate.getTime())
        .slice(0, 20),
      recentDepartures: departures.slice(0, 20).map((d) => ({
        id: d.id,
        departureDate: d.departureDate,
        departureTime: d.departureTime,
        returnTime: d.returnTime,
        departureType: d.departureType,
        reason: d.reason,
        approvalStatus: d.approvalStatus,
        affectedPeriodCount: d.affectedPeriodCount,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
