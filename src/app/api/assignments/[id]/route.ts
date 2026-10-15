import { NextRequest, NextResponse } from "next/server";
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
  const a = await db.assignment.findUnique({
    where: { id },
    include: {
      workType: true,
      schoolYear: true,
      schoolPeriod: true,
      workRecords: { include: { teacher: true, reviews: true } },
    },
  });
  if (!a) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(a);
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
    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const update: any = { ...body };
    if (body.assignedDate) update.assignedDate = new Date(body.assignedDate);
    if (body.dueDate) update.dueDate = new Date(body.dueDate);
    if (body.coveredPeriodStart) update.coveredPeriodStart = new Date(body.coveredPeriodStart);
    if (body.coveredPeriodEnd) update.coveredPeriodEnd = new Date(body.coveredPeriodEnd);
    if (body.coveredPeriodStart === null) update.coveredPeriodStart = null;
    if (body.coveredPeriodEnd === null) update.coveredPeriodEnd = null;
    delete update.workTypeId; // Don't change work type after creation
    delete update.schoolYearId;
    delete update.teacherIds;

    const a = await db.assignment.update({ where: { id }, data: update });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "Assignment",
      entityId: id,
      previousValues: existing,
      newValues: body,
    });
    return NextResponse.json(a);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
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
    const existing = await db.assignment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    // Soft cancel
    await db.assignment.update({ where: { id }, data: { assignmentStatus: "CANCELLED" } });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "DELETE",
      entityType: "Assignment",
      entityId: id,
      previousValues: existing,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
