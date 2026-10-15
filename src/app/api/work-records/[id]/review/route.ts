import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const ReviewSchema = z.object({
  reviewResult: z.enum(["APPROVED", "NEEDS_REVISION", "REJECTED"]),
  reviewNotes: z.string().optional().nullable(),
});

// POST = perform review action (approve / return for revision / reject)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const existing = await db.workRecord.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const previousStatus = existing.status;
    let newStatus: string;
    if (d.reviewResult === "APPROVED") newStatus = "APPROVED";
    else if (d.reviewResult === "NEEDS_REVISION") newStatus = "NEEDS_REVISION";
    else newStatus = "REJECTED";

    const wr = await db.$transaction(async (tx) => {
      // Create review record
      await tx.review.create({
        data: {
          workRecordId: id,
          reviewResult: d.reviewResult,
          reviewNotes: d.reviewNotes || null,
          administratorId: admin.id,
          previousStatus,
          newStatus,
        },
      });

      // Update work record
      const update: any = { status: newStatus };
      if (d.reviewResult === "APPROVED") {
        update.approvedAt = new Date();
        update.approvedById = admin.id;
      }
      if (d.reviewResult === "NEEDS_REVISION") {
        update.revisionNotes = d.reviewNotes || null;
      }
      return tx.workRecord.update({ where: { id }, data: update });
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: d.reviewResult === "APPROVED" ? "APPROVE" : d.reviewResult === "REJECTED" ? "REJECT" : "UPDATE",
      entityType: "WorkRecord",
      entityId: id,
      previousValues: { status: previousStatus },
      newValues: { status: newStatus, reviewResult: d.reviewResult },
    });

    return NextResponse.json(wr);
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
