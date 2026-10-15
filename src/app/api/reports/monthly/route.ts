import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getReportKPIs } from "@/lib/kpi";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const teacherId = url.searchParams.get("teacherId");

    if (!start || !end) {
      return NextResponse.json({ error: "start و end مطلوبان" }, { status: 400 });
    }

    const range = { start: new Date(start), end: new Date(end + "T23:59:59") };

    // Override range if teacher filter applies — KPIs computed globally though
    const kpis = await getReportKPIs(range);

    // Get work records with details for the report
    const where: any = {
      assignment: {
        dueDate: { gte: range.start, lte: range.end },
        assignmentStatus: { in: ["ACTIVE", "COMPLETED"] },
      },
      status: { not: "CANCELLED" },
    };
    if (teacherId) where.teacherId = teacherId;

    const records = await db.workRecord.findMany({
      where,
      include: {
        teacher: true,
        assignment: { include: { workType: true } },
        reviews: { include: { administrator: { select: { name: true } } } },
      },
      orderBy: { assignment: { dueDate: "asc" } },
      take: 500,
    });

    // Substitutions within range
    const substitutions = await db.substitution.findMany({
      where: { substitutionDate: { gte: range.start, lte: range.end } },
      include: { originalTeacher: true, substituteTeacher: true },
    });

    // Departures within range
    const departures = await db.departure.findMany({
      where: { departureDate: { gte: range.start, lte: range.end } },
      include: { teacher: true },
    });

    // Group by work type for "most delayed"
    const byWorkType: Record<string, { total: number; overdue: number; completed: number }> = {};
    for (const r of records) {
      const name = r.assignment.workType?.name || "غير مصنف";
      if (!byWorkType[name]) byWorkType[name] = { total: 0, overdue: 0, completed: 0 };
      byWorkType[name].total += 1;
      if (r.assignment.dueDate < new Date() && ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status)) {
        byWorkType[name].overdue += 1;
      }
      if (["SUBMITTED", "COMPLETED", "APPROVED"].includes(r.status)) {
        byWorkType[name].completed += 1;
      }
    }
    const mostDelayed = Object.entries(byWorkType)
      .map(([name, d]) => ({ name, ...d, delayRate: d.total > 0 ? (d.overdue / d.total) * 100 : 0 }))
      .filter((d) => d.overdue > 0)
      .sort((a, b) => b.delayRate - a.delayRate)
      .slice(0, 10);

    return NextResponse.json({
      range,
      kpis,
      records: records.map((r) => ({
        id: r.id,
        teacher: r.teacher.fullName,
        workType: r.assignment.workType?.name,
        title: r.assignment.title,
        assignedDate: r.assignment.assignedDate,
        dueDate: r.assignment.dueDate,
        completionDate: r.completionDate,
        status: r.status,
        approvedAt: r.approvedAt,
        reviews: r.reviews,
      })),
      substitutions: substitutions.map((s) => ({
        id: s.id,
        date: s.substitutionDate,
        period: s.periodNumber,
        original: s.originalTeacher?.fullName || null,
        substitute: s.substituteTeacher?.fullName || "غير معين",
        class: s.className,
        reason: s.reasonType,
        periods: s.numberOfPeriods,
      })),
      departures: departures.map((d) => ({
        id: d.id,
        teacher: d.teacher.fullName,
        date: d.departureDate,
        departureTime: d.departureTime,
        returnTime: d.returnTime,
        type: d.departureType,
        approvalStatus: d.approvalStatus,
        affectedPeriods: d.affectedPeriodCount,
      })),
      byWorkType: Object.entries(byWorkType).map(([name, d]) => ({ name, ...d })),
      mostDelayed,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
