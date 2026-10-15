import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const dep = await db.departure.findUnique({ where: { id }, include: { teacher: true } });
  if (!dep) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(dep);
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
    const existing = await db.departure.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const update: any = { ...body };
    if (body.departureDate) update.departureDate = new Date(body.departureDate);
    const dep = await db.departure.update({ where: { id }, data: update, include: { teacher: true } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "Departure",
      entityId: id,
      previousValues: existing,
      newValues: body,
    });
    return NextResponse.json(dep);
  } catch (e) {
    return apiError(e, "فشلت العملية");
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
    const existing = await db.departure.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    await db.departure.delete({ where: { id } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "DELETE",
      entityType: "Departure",
      entityId: id,
      previousValues: existing,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
