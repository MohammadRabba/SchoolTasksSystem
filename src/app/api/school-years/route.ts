import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const SchoolYearSchema = z.object({
  name: z.string().min(2),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().default(false),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const years = await db.schoolYear.findMany({
    include: { terms: true },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(years);
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
    const parsed = SchoolYearSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const d = parsed.data;
    // If active, deactivate others
    if (d.isActive) {
      await db.schoolYear.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    const year = await db.schoolYear.create({
      data: {
        name: d.name,
        startDate: new Date(d.startDate),
        endDate: new Date(d.endDate),
        isActive: d.isActive,
      },
      include: { terms: true },
    });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "SchoolYear",
      entityId: year.id,
      newValues: d,
    });
    return NextResponse.json(year, { status: 201 });
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
