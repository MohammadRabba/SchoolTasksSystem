import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

// One-time setup: creates the single admin if none exists yet
const SetupSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export async function POST(req: NextRequest) {
  try {
    // Refuse if any admin already exists
    const existing = await db.admin.count();
    if (existing > 0) {
      return NextResponse.json(
        { error: "تم إعداد حساب المدير مسبقًا. يُرجى تسجيل الدخول." },
        { status: 409 }
      );
    }

    const body = await req.json();
    const parsed = SetupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await db.admin.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
      },
    });

    // Seed default settings + school year + work types if none exist
    await seedDefaults(admin.id, name, email.toLowerCase().trim());

    return NextResponse.json({ ok: true, id: admin.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  // Public: tells the client whether to show Setup vs Login
  const count = await db.admin.count();
  return NextResponse.json({ setupRequired: count === 0 });
}

async function seedDefaults(adminId: string, name: string, email: string) {
  // Settings (if not exists)
  const settingsCount = await db.setting.count();
  if (settingsCount === 0) {
    await db.setting.create({ data: {} });
  }

  // Active school year + two terms
  const yearCount = await db.schoolYear.count();
  if (yearCount === 0) {
    const startDate = new Date("2025-09-01T00:00:00Z");
    const endDate = new Date("2026-06-30T00:00:00Z");
    const year = await db.schoolYear.create({
      data: {
        name: "2025/2026",
        startDate,
        endDate,
        isActive: true,
      },
    });
    await db.schoolPeriod.createMany({
      data: [
        {
          schoolYearId: year.id,
          name: "الفصل الأول",
          startDate: new Date("2025-09-01T00:00:00Z"),
          endDate: new Date("2025-12-31T00:00:00Z"),
          isActive: true,
        },
        {
          schoolYearId: year.id,
          name: "الفصل الثاني",
          startDate: new Date("2026-01-15T00:00:00Z"),
          endDate: new Date("2026-06-30T00:00:00Z"),
        },
      ],
    });
  }

  // Default work types
  const wtCount = await db.workType.count();
  if (wtCount === 0) {
    await db.workType.createMany({
      data: [
        { name: "تحضير الدروس اليومي", defaultFrequency: "DAILY", defaultCompletionDays: 1, requiresApproval: false },
        { name: "الخطة الفصلية", defaultFrequency: "TERM_BASED", defaultCompletionDays: 14, requiresApproval: true },
        { name: "الخطة السنوية", defaultFrequency: "ANNUAL", defaultCompletionDays: 30, requiresApproval: true },
        { name: "توزيع المنهج", defaultFrequency: "ANNUAL", defaultCompletionDays: 21, requiresApproval: true },
        { name: "دفتر العلامات", defaultFrequency: "MONTHLY", defaultCompletionDays: 7, requiresApproval: true },
        { name: "سجل الحضور والغياب", defaultFrequency: "DAILY", defaultCompletionDays: 1, requiresApproval: false },
        { name: "أوراق العمل والاختبارات", defaultFrequency: "MONTHLY", defaultCompletionDays: 7, requiresApproval: true },
        { name: "الملف المهني للمعلم", defaultFrequency: "ANNUAL", defaultCompletionDays: 30, requiresApproval: true },
        { name: "تقارير الأداء الطلابي", defaultFrequency: "MONTHLY", defaultCompletionDays: 7, requiresApproval: true },
        { name: "تقارير إدارية", defaultFrequency: "ONE_TIME", defaultCompletionDays: 3, requiresApproval: true },
      ],
    });
  }

  // Initial audit log
  await db.auditLog.create({
    data: {
      administratorId: adminId,
      actionType: "SETUP",
      entityType: "Admin",
      entityId: adminId,
      newValues: JSON.stringify({ name, email: "(hidden)" }),
    },
  });
}
