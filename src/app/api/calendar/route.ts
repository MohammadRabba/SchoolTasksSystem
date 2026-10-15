import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(0).max(11),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = QuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "سنة وشهر مطلوبان" }, { status: 400 });
    }
    const { year, month } = parsed.data;

    // Compute month range
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);

    // Fetch all events in parallel
    const [assignments, substitutions, departures] = await Promise.all([
      db.assignment.findMany({
        where: {
          dueDate: { gte: start, lte: end },
          archivedAt: null,
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          priority: true,
          assignmentStatus: true,
          workType: { select: { name: true } },
        },
      }),
      db.substitution.findMany({
        where: { substitutionDate: { gte: start, lte: end } },
        include: {
          originalTeacher: { select: { fullName: true } },
          substituteTeacher: { select: { fullName: true } },
        },
      }),
      db.departure.findMany({
        where: { departureDate: { gte: start, lte: end } },
        include: { teacher: { select: { fullName: true } } },
      }),
    ]);

    // Bucket by day-of-month
    const byDay: Record<number, any[]> = {};
    function add(day: number, ev: any) {
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(ev);
    }

    for (const a of assignments) {
      add(a.dueDate.getDate(), {
        type: "assignment",
        id: a.id,
        title: a.title,
        priority: a.priority,
        status: a.assignmentStatus,
        workType: a.workType?.name,
      });
    }
    for (const s of substitutions) {
      add(s.substitutionDate.getDate(), {
        type: "substitution",
        id: s.id,
        title: `إشغال ${s.className}${s.sectionName ? ` (${s.sectionName})` : ""}`,
        period: s.periodNumber,
        substitute: s.substituteTeacher?.fullName || "غير معين",
        original: s.originalTeacher?.fullName || null,
        unassigned: !s.substituteTeacherId,
      });
    }
    for (const d of departures) {
      add(d.departureDate.getDate(), {
        type: "departure",
        id: d.id,
        title: `مغادرة ${d.teacher?.fullName || "—"}`,
        time: d.departureTime,
        returnTime: d.returnTime,
        approvalStatus: d.approvalStatus,
      });
    }

    return NextResponse.json({
      year,
      month,
      totalEvents: assignments.length + substitutions.length + departures.length,
      byDay,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
