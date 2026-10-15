import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

const UpdateSchema = z.object({
  className: z.string().min(1).optional(),
  sectionName: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

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
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const existing = await db.classSection.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const updated = await db.classSection.update({ where: { id }, data: parsed.data });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "ClassSection",
      entityId: id,
      previousValues: existing,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    return apiError(e, "فشل التحديث");
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
    const existing = await db.classSection.findUnique({
      where: { id },
      include: { _count: { select: { teachers: true } } },
    });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    if (existing._count.teachers > 0) {
      return NextResponse.json(
        { error: `لا يمكن حذف الصف — مرتبط بـ ${existing._count.teachers} معلم. استخدم تعطيل بدلاً من الحذف.` },
        { status: 400 }
      );
    }
    await db.classSection.delete({ where: { id } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "DELETE",
      entityType: "ClassSection",
      entityId: id,
      previousValues: existing,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "فشل الحذف");
  }
}
