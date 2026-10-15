import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

// POST /api/assignments/[id]/archive — soft-archive an assignment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const updated = await db.assignment.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "ARCHIVE",
      entityType: "Assignment",
      entityId: id,
      previousValues: { archivedAt: existing.archivedAt },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
