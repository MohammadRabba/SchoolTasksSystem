import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const QuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const OVERDUE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"];

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
      return NextResponse.json({ error: "استعلام غير صالح" }, { status: 400 });
    }
    const { q, limit } = parsed.data;
    const needle = q.trim();
    if (!needle) return NextResponse.json({ results: [] });

    // Run parallel searches across all entity types
    const [teachers, assignments, substitutions, departures] = await Promise.all([
      db.teacher.findMany({
        where: {
          OR: [
            { fullName: { contains: needle } },
            { employeeNumber: { contains: needle } },
            { specialization: { contains: needle } },
            { subjects: { contains: needle } },
          ],
          archivedAt: null,
        },
        take: limit,
        select: { id: true, fullName: true, employeeNumber: true, specialization: true, subjects: true, employmentStatus: true },
      }),
      db.assignment.findMany({
        where: {
          OR: [
            { title: { contains: needle } },
            { description: { contains: needle } },
          ],
          archivedAt: null,
        },
        take: limit,
        include: { workType: { select: { name: true } } },
      }),
      db.substitution.findMany({
        where: {
          OR: [
            { className: { contains: needle } },
            { sectionName: { contains: needle } },
            { customReason: { contains: needle } },
            { administrativeNotes: { contains: needle } },
            { originalTeacher: { fullName: { contains: needle } } },
            { substituteTeacher: { fullName: { contains: needle } } },
          ],
        },
        take: limit,
        include: {
          originalTeacher: { select: { fullName: true } },
          substituteTeacher: { select: { fullName: true } },
        },
      }),
      db.departure.findMany({
        where: {
          OR: [
            { reason: { contains: needle } },
            { coverageArrangements: { contains: needle } },
            { administrativeNotes: { contains: needle } },
            { teacher: { fullName: { contains: needle } } },
          ],
        },
        take: limit,
        include: { teacher: { select: { fullName: true } } },
      }),
    ]);

    const results = [
      ...teachers.map((t) => ({
        type: "teacher",
        id: t.id,
        title: t.fullName,
        subtitle: [t.specialization, t.subjects].filter(Boolean).join(" • ") || "معلم",
        badge: t.employeeNumber || "",
      })),
      ...assignments.map((a) => ({
        type: "assignment",
        id: a.id,
        title: a.title,
        subtitle: a.workType?.name || "تكليف",
        badge: new Date(a.dueDate).toLocaleDateString("ar-EG"),
      })),
      ...substitutions.map((s) => ({
        type: "substitution",
        id: s.id,
        title: `إشغال ${s.className}${s.sectionName ? ` (${s.sectionName})` : ""}`,
        subtitle: `${s.originalTeacher?.fullName || "—"} → ${s.substituteTeacher?.fullName || "غير معين"}`,
        badge: new Date(s.substitutionDate).toLocaleDateString("ar-EG"),
      })),
      ...departures.map((d) => ({
        type: "departure",
        id: d.id,
        title: `مغادرة ${d.teacher?.fullName || "—"}`,
        subtitle: d.reason || d.departureType,
        badge: new Date(d.departureDate).toLocaleDateString("ar-EG"),
      })),
    ];

    return NextResponse.json({
      query: needle,
      total: results.length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
