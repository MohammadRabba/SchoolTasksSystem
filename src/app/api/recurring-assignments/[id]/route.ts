import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const UpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional(),
  daysOfWeek: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  dueOffsetDays: z.number().int().min(0).max(30).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  schoolPeriodId: z.string().optional().nullable(),
  adminInstructions: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  teacherIds: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const item = await db.recurringAssignment.findUnique({
    where: { id },
    include: {
      workType: true,
      schoolYear: true,
      schoolPeriod: true,
      teachers: { include: { teacher: true } },
      assignments: {
        orderBy: { dueDate: "desc" },
        take: 50,
        include: { _count: { select: { workRecords: true } } },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(item);
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
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const existing = await db.recurringAssignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const update: any = { ...d };
    if (d.startDate) update.startDate = new Date(d.startDate);
    if (d.endDate) update.endDate = new Date(d.endDate);
    delete update.teacherIds;

    const updated = await db.recurringAssignment.update({
      where: { id },
      data: update,
    });

    // Update teacher associations if provided
    if (d.teacherIds) {
      await db.recurringAssignmentTeacher.deleteMany({ where: { recurringAssignmentId: id } });
      if (d.teacherIds.length > 0) {
        await db.recurringAssignmentTeacher.createMany({
          data: d.teacherIds.map((teacherId) => ({
            recurringAssignmentId: id,
            teacherId,
          })),
        });
      }
    }

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "RecurringAssignment",
      entityId: id,
      previousValues: existing,
      newValues: d,
    });

    return NextResponse.json(updated);
  } catch (e) {
    return apiError(e, "فشل تحديث التكليف التلقائي");
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
    const existing = await db.recurringAssignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    // Check if any generated assignments exist
    const generatedCount = await db.assignment.count({
      where: { recurringAssignmentId: id, assignmentStatus: "ACTIVE" },
    });
    if (generatedCount > 0) {
      return NextResponse.json(
        {
          error: `لا يمكن حذف التكليف التلقائي لأنه يوجد ${generatedCount} تكليف نشط تم توليده منه. يُرجى تعطيله بدلاً من الحذف.`,
        },
        { status: 400 }
      );
    }

    await db.recurringAssignment.delete({ where: { id } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "DELETE",
      entityType: "RecurringAssignment",
      entityId: id,
      previousValues: existing,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "فشل حذف التكليف التلقائي");
  }
}
