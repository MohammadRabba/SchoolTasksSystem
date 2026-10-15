import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const WorkTypeSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  description: z.string().optional().nullable(),
  defaultFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "TERM_BASED", "ANNUAL", "ONE_TIME"]).default("WEEKLY"),
  defaultCompletionDays: z.number().int().min(1).optional().nullable(),
  requiresApproval: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const items = await db.workType.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = WorkTypeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const wt = await db.workType.create({ data: parsed.data });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "WorkType",
      entityId: wt.id,
      newValues: parsed.data,
    });
    return NextResponse.json(wt, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
