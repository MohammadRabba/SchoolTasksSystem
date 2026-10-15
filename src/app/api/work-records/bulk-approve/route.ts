import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

// Bulk approve submitted/completed work records (single transaction)
const BulkApproveSchema = z.object({
  recordIds: z.array(z.string()).min(1, "اختر سجلاً واحدًا على الأقل").max(200, "الحد الأقصى 200 سجل"),
  reviewNotes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = BulkApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const { recordIds, reviewNotes } = parsed.data;
    const now = new Date();

    // Fetch the records first (to validate ownership + capture previous states)
    const records = await db.workRecord.findMany({
      where: { id: { in: recordIds } },
      include: { assignment: true },
    });
    if (records.length === 0) {
      return NextResponse.json({ error: "لم يتم العثور على سجلات مطابقة" }, { status: 404 });
    }

    // Filter: only SUBMITTED / COMPLETED records can be bulk-approved
    const approvable = records.filter((r) => ["SUBMITTED", "COMPLETED"].includes(r.status));
    const skipped = records.length - approvable.length;
    if (approvable.length === 0) {
      return NextResponse.json(
        { error: "كل السجلات المحددة ليست بحالة قابلة للاعتماد (SUBMITTED/COMPLETED)" },
        { status: 400 }
      );
    }

    // Transaction: update + create review log per record
    const result = await db.$transaction(async (tx) => {
      const updated: string[] = [];
      for (const r of approvable) {
        await tx.review.create({
          data: {
            workRecordId: r.id,
            reviewResult: "APPROVED",
            reviewNotes: reviewNotes || null,
            administratorId: admin.id,
            previousStatus: r.status,
            newStatus: "APPROVED",
          },
        });
        await tx.workRecord.update({
          where: { id: r.id },
          data: {
            status: "APPROVED",
            approvedAt: now,
            approvedById: admin.id,
          },
        });
        updated.push(r.id);
      }
      return updated;
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "APPROVE",
      entityType: "WorkRecord",
      newValues: {
        count: result.length,
        skipped,
        reviewNotes: reviewNotes || null,
      },
    });

    return NextResponse.json({
      approved: result.length,
      skipped,
      totalRequested: recordIds.length,
    });
  } catch (e) {
    return apiError(e, "فشل الاعتماد المجمّع");
  }
}
