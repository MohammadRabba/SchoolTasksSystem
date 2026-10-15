import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

const BulkActionSchema = z.object({
  teacherIds: z.array(z.string()).min(1).max(200),
  action: z.enum(["ARCHIVE", "UNARCHIVE", "SET_ACTIVE", "SET_ON_LEAVE", "SET_INACTIVE"]),
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
    const { teacherIds, action } = parsed.data;

    let updateData: any = {};
    switch (action) {
      case "ARCHIVE":
        updateData.archivedAt = new Date();
        updateData.employmentStatus = "INACTIVE";
        break;
      case "UNARCHIVE":
        updateData.archivedAt = null;
        updateData.employmentStatus = "ACTIVE";
        break;
      case "SET_ACTIVE":
        updateData.employmentStatus = "ACTIVE";
        break;
      case "SET_ON_LEAVE":
        updateData.employmentStatus = "ON_LEAVE";
        break;
      case "SET_INACTIVE":
        updateData.employmentStatus = "INACTIVE";
        break;
    }

    const result = await db.teacher.updateMany({
      where: { id: { in: teacherIds } },
      data: updateData,
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: action === "ARCHIVE" ? "ARCHIVE" : "UPDATE",
      entityType: "Teacher",
      newValues: { count: result.count, action, teacherIds: teacherIds.length },
    });

    return NextResponse.json({
      affected: result.count,
      action,
    });
  } catch (e) {
    return apiError(e, "فشلت العملية المجمّعة");
  }
}
