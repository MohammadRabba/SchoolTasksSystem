import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const TeacherUpdateSchema = z.object({
  employeeNumber: z.string().optional().nullable(),
  fullName: z.string().min(2).optional(),
  specialization: z.string().optional().nullable(),
  subjects: z.string().optional().nullable(),
  weeklyPeriodCount: z.number().int().min(0).optional(),
  employmentStartDate: z.string().optional().nullable(),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]).optional(),
  administrativeNotes: z.string().optional().nullable(),
  classesAndSections: z.array(z.object({ className: z.string(), sectionName: z.string().optional().nullable() })).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const teacher = await db.teacher.findUnique({
    where: { id },
    include: {
      classesAndSections: true,
      workRecords: { include: { assignment: { include: { workType: true } } }, orderBy: { updatedAt: "desc" }, take: 50 },
      substitutionsAsOriginal: { take: 50, orderBy: { substitutionDate: "desc" } },
      substitutionsAsSubstitute: { take: 50, orderBy: { substitutionDate: "desc" } },
      departures: { take: 50, orderBy: { departureDate: "desc" } },
    },
  });
  if (!teacher) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(teacher);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = TeacherUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    if (d.employeeNumber && d.employeeNumber !== existing.employeeNumber) {
      const dup = await db.teacher.findUnique({ where: { employeeNumber: d.employeeNumber } });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: "الرقم الوظيفي مستخدم بالفعل" }, { status: 400 });
      }
    }

    const updateData: any = { ...d };
    if (d.employmentStartDate !== undefined) {
      updateData.employmentStartDate = d.employmentStartDate ? new Date(d.employmentStartDate) : null;
    }
    delete updateData.classesAndSections;

    const teacher = await db.teacher.update({
      where: { id },
      data: updateData,
      include: { classesAndSections: true },
    });

    if (d.classesAndSections) {
      await db.teacherClassSection.deleteMany({ where: { teacherId: id } });
      if (d.classesAndSections.length > 0) {
        await db.teacherClassSection.createMany({
          data: d.classesAndSections.map((c) => ({
            teacherId: id,
            className: c.className,
            sectionName: c.sectionName || null,
          })),
        });
      }
    }

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "Teacher",
      entityId: id,
      previousValues: existing,
      newValues: d,
    });

    return NextResponse.json(teacher);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const existing = await db.teacher.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // Archive instead of hard delete — protect historical records
    const teacher = await db.teacher.update({
      where: { id },
      data: { archivedAt: new Date(), employmentStatus: "INACTIVE" },
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "ARCHIVE",
      entityType: "Teacher",
      entityId: id,
      previousValues: existing,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
