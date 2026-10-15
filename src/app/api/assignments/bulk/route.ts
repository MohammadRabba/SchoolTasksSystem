import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

const BulkActionSchema = z.object({
  assignmentIds: z.array(z.string()).min(1).max(200),
  action: z.enum(["CANCEL", "RESTORE", "ARCHIVE", "UNARCHIVE", "SET_PRIORITY"]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
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
    const parsed = BulkActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const { assignmentIds, action, priority } = parsed.data;

    let updateData: any = {};
    switch (action) {
      case "CANCEL":
        updateData.assignmentStatus = "CANCELLED";
        break;
      case "RESTORE":
        updateData.assignmentStatus = "ACTIVE";
        break;
      case "ARCHIVE":
        updateData.archivedAt = new Date();
        break;
      case "UNARCHIVE":
        updateData.archivedAt = null;
        break;
      case "SET_PRIORITY":
        if (!priority) {
          return NextResponse.json(
            { error: "الأولوية مطلوبة عند SET_PRIORITY" },
            { status: 400 }
          );
        }
        updateData.priority = priority;
        break;
    }

    const result = await db.assignment.updateMany({
      where: { id: { in: assignmentIds } },
      data: updateData,
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: action === "ARCHIVE" ? "ARCHIVE" : action === "CANCEL" ? "DELETE" : "UPDATE",
      entityType: "Assignment",
      newValues: { count: result.count, action, priority: priority || null },
    });

    return NextResponse.json({
      affected: result.count,
      action,
    });
  } catch (e) {
    return apiError(e, "فشلت العملية المجمّعة");
  }
}
