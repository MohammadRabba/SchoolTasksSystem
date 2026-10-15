import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const SubstitutionSchema = z.object({
  substitutionDate: z.string(),
  periodNumber: z.number().int().min(1),
  periodStartTime: z.string().optional().nullable(),
  periodEndTime: z.string().optional().nullable(),
  originalTeacherId: z.string().optional().nullable(),
  substituteTeacherId: z.string().optional().nullable(),
  className: z.string().min(1, "الصف مطلوب"),
  sectionName: z.string().optional().nullable(),
  reasonType: z.enum(["ABSENCE", "DEPARTURE_LEAVE", "ADMIN_ASSIGNMENT", "EMERGENCY", "OTHER"]),
  customReason: z.string().optional().nullable(),
  numberOfPeriods: z.number().int().min(1).default(1),
  administrativeNotes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
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
    const unassigned = url.searchParams.get("unassigned") === "true";

    const where: any = {};
    if (start && end) {
      where.substitutionDate = { gte: new Date(start), lte: new Date(end + "T23:59:59") };
    }
    if (teacherId) {
      where.OR = [{ originalTeacherId: teacherId }, { substituteTeacherId: teacherId }];
    }
    if (unassigned) where.substituteTeacherId = null;

    const subs = await db.substitution.findMany({
      where,
      include: {
        originalTeacher: true,
        substituteTeacher: true,
      },
      orderBy: { substitutionDate: "desc" },
      take: 200,
    });
    return NextResponse.json(subs);
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = SubstitutionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const d = parsed.data;
    const sub = await db.substitution.create({
      data: {
        substitutionDate: new Date(d.substitutionDate),
        periodNumber: d.periodNumber,
        periodStartTime: d.periodStartTime || null,
        periodEndTime: d.periodEndTime || null,
        originalTeacherId: d.originalTeacherId || null,
        substituteTeacherId: d.substituteTeacherId || null,
        className: d.className,
        sectionName: d.sectionName || null,
        reasonType: d.reasonType,
        customReason: d.customReason || null,
        numberOfPeriods: d.numberOfPeriods,
        administrativeNotes: d.administrativeNotes || null,
      },
      include: { originalTeacher: true, substituteTeacher: true },
    });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "Substitution",
      entityId: sub.id,
      newValues: d,
    });
    return NextResponse.json(sub, { status: 201 });
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
