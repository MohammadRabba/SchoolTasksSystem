import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/reports/ranking?start=...&end=...
 * Returns teachers ranked by various performance metrics.
 *
 * IMPORTANT: Per spec, these are STATISTICAL indicators only — they do NOT
 * constitute a personal performance rating. The response includes a
 * disclaimer in the UI; this API returns raw numbers.
 */
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

    if (!start || !end) {
      return NextResponse.json({ error: "start و end مطلوبان" }, { status: 400 });
    }

    const range = { start: new Date(start), end: new Date(end + "T23:59:59") };

    // Aggregate work records by teacher
    const records = await db.workRecord.findMany({
      where: {
        assignment: {
          dueDate: { gte: range.start, lte: range.end },
          assignmentStatus: "ACTIVE",
          archivedAt: null,
        },
        status: { not: "CANCELLED" },
      },
      include: { assignment: true, teacher: true },
    });

    const byTeacher: Record<string, any> = {};
    const now = new Date();
    for (const r of records) {
      const tid = r.teacherId;
      if (!byTeacher[tid]) {
        byTeacher[tid] = {
          teacherId: tid,
          teacherName: r.teacher?.fullName || "—",
          specialization: r.teacher?.specialization,
          total: 0,
          completed: 0,
          approved: 0,
          overdue: 0,
          needsRevision: 0,
          onTime: 0,
        };
      }
      const t = byTeacher[tid];
      t.total++;
      if (["SUBMITTED", "COMPLETED", "APPROVED"].includes(r.status)) t.completed++;
      if (r.status === "APPROVED") t.approved++;
      if (["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status) && r.assignment.dueDate.getTime() < now.getTime()) t.overdue++;
      if (r.status === "NEEDS_REVISION") t.needsRevision++;
      if (r.completionDate && ["SUBMITTED", "COMPLETED", "APPROVED"].includes(r.status) && r.completionDate.getTime() <= r.assignment.dueDate.getTime()) t.onTime++;
    }

    const teachers = Object.values(byTeacher);
    for (const t of teachers) {
      t.completionRate = t.total ? (t.completed / t.total) * 100 : null;
      t.onTimeRate = t.total ? (t.onTime / t.total) * 100 : null;
      t.overdueRate = t.total ? (t.overdue / t.total) * 100 : null;
      t.approvalRate = t.total ? (t.approved / t.total) * 100 : null;
    }

    const byOnTime = [...teachers].sort((a, b) => (b.onTimeRate ?? 0) - (a.onTimeRate ?? 0));
    const byOverdueAsc = [...teachers].sort((a, b) => (a.overdue ?? 0) - (b.overdue ?? 0));
    const byRevision = [...teachers].sort((a, b) => b.needsRevision - a.needsRevision);

    return NextResponse.json({
      disclaimer:
        "هذه أرقام إحصائية فقط ولا تعني تقييمًا شخصيًا للمعلم. استخدمها للكشف عن المعلمين الذين قد يحتاجون دعمًا أو تدريبًا إضافيًا.",
      period: { start: range.start, end: range.end },
      rankings: {
        byOnTimeRate: byOnTime.slice(0, 20),
        byFewestOverdue: byOverdueAsc.slice(0, 20),
        byFewestRevisions: byRevision.slice(0, 20),
      },
      total: teachers.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
