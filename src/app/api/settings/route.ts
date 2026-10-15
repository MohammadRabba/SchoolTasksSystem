import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const SettingsSchema = z.object({
  schoolNameAr: z.string().optional(),
  schoolNameEn: z.string().optional(),
  logoUrl: z.string().optional().nullable(),
  timezone: z.string().optional(),
  workingDays: z.string().optional(),
  defaultDeadlineDays: z.number().int().min(1).optional(),
  notificationThresholdDays: z.number().int().min(1).optional(),
  maxSubstitutionPeriods: z.number().int().min(1).optional(),
  reportWeekStart: z.string().optional(),
  academicYearName: z.string().optional(),
  pdfFontName: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const settings = await db.setting.findFirst();
  if (!settings) {
    return NextResponse.json(await db.setting.create({ data: {} }));
  }
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const existing = await db.setting.findFirst();
    let settings;
    if (!existing) {
      settings = await db.setting.create({ data: parsed.data as any });
    } else {
      settings = await db.setting.update({ where: { id: existing.id }, data: parsed.data as any });
      await writeAuditLog({
        administratorId: admin.id,
        actionType: "UPDATE",
        entityType: "Settings",
        entityId: existing.id,
        previousValues: existing,
        newValues: parsed.data,
      });
    }
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
