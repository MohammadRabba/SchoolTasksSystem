import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const WorkTypeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  defaultFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "TERM_BASED", "ANNUAL", "ONE_TIME"]).optional(),
  defaultCompletionDays: z.number().int().min(1).optional().nullable(),
  requiresApproval: z.boolean().optional(),
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
    const parsed = WorkTypeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const existing = await db.workType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const wt = await db.workType.update({ where: { id }, data: parsed.data });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "WorkType",
      entityId: id,
      previousValues: existing,
      newValues: parsed.data,
    });
    return NextResponse.json(wt);
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
    const existing = await db.workType.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    // Soft delete by setting isActive=false
    await db.workType.update({ where: { id }, data: { isActive: false } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "DELETE",
      entityType: "WorkType",
      entityId: id,
      previousValues: existing,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
