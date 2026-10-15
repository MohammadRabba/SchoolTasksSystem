import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const existing = await db.substitution.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    await db.substitution.delete({ where: { id } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "DELETE",
      entityType: "Substitution",
      entityId: id,
      previousValues: existing,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
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
    const existing = await db.substitution.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const update: any = { ...body };
    if (body.substitutionDate) update.substitutionDate = new Date(body.substitutionDate);
    const sub = await db.substitution.update({ where: { id }, data: update });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "Substitution",
      entityId: id,
      previousValues: existing,
      newValues: body,
    });
    return NextResponse.json(sub);
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
