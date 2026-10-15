import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const ApproveSchema = z.object({
  approvalStatus: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
  authorizedBy: z.string().optional().nullable(),
});

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
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const d = parsed.data;
    const existing = await db.departure.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

    const dep = await db.departure.update({
      where: { id },
      data: {
        approvalStatus: d.approvalStatus,
        authorizedBy: d.authorizedBy || admin.name,
      },
      include: { teacher: true },
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: d.approvalStatus === "APPROVED" ? "APPROVE" : d.approvalStatus === "REJECTED" ? "REJECT" : "UPDATE",
      entityType: "Departure",
      entityId: id,
      previousValues: { approvalStatus: existing.approvalStatus },
      newValues: { approvalStatus: d.approvalStatus },
    });

    return NextResponse.json(dep);
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
