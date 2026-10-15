import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const UpdateStatusSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "COMPLETED", "REJECTED", "CANCELLED"]),
  completionDate: z.string().optional().nullable(),
  submittedAt: z.string().optional().nullable(),
  administrativeNotes: z.string().optional().nullable(),
  revisionNotes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  const wr = await db.workRecord.findUnique({
    where: { id },
    include: {
      assignment: { include: { workType: true, schoolYear: true, schoolPeriod: true } },
      teacher: true,
      reviews: { include: { administrator: { select: { name: true } } }, orderBy: { reviewedAt: "desc" } },
    },
  });
  if (!wr) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(wr);
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
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const existing = await db.workRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const update: any = { status: d.status };
    if (d.completionDate !== undefined) {
      update.completionDate = d.completionDate ? new Date(d.completionDate) : null;
    }
    if (d.submittedAt !== undefined) {
      update.submittedAt = d.submittedAt ? new Date(d.submittedAt) : null;
    }
    if (d.administrativeNotes !== undefined) update.administrativeNotes = d.administrativeNotes;
    if (d.revisionNotes !== undefined) update.revisionNotes = d.revisionNotes;

    const wr = await db.workRecord.update({ where: { id }, data: update });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "UPDATE",
      entityType: "WorkRecord",
      entityId: id,
      previousValues: { status: existing.status },
      newValues: { status: d.status },
    });
    return NextResponse.json(wr);
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
