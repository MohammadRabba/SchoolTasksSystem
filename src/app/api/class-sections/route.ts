import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

const ClassSectionSchema = z.object({
  className: z.string().min(1, "اسم الصف مطلوب"),
  sectionName: z.string().min(1, "اسم الشعبة مطلوب"),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const items = await db.classSection.findMany({
    include: { _count: { select: { teachers: true } } },
    orderBy: [{ className: "asc" }, { sectionName: "asc" }],
  });
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
    const parsed = ClassSectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const cs = await db.classSection.create({ data: parsed.data });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "ClassSection",
      entityId: cs.id,
      newValues: parsed.data,
    });
    return NextResponse.json(cs, { status: 201 });
  } catch (e) {
    return apiError(e, "فشل إنشاء الصف/الشعبة");
  }
}
