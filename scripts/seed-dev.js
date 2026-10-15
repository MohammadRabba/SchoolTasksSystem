/**
 * Development seed script.
 *
 * Seeds a SMALL set of demo data into the development SQLite database for
 * testing the application locally. NEVER run against a production database.
 *
 * PRODUCTION PROTECTION:
 *   - Refuses if DATABASE_URL looks like a production Neon URL
 *   - Refuses if NODE_ENV=production
 *
 * Usage:
 *   bun run scripts/seed-dev.js
 *
 * Idempotent: re-running will skip seeding if records already exist
 * (uses upsert-like pattern: check, then insert if missing).
 */

const { execSync } = require("child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const DATABASE_URL = process.env.DATABASE_URL || "";
const NODE_ENV = process.env.NODE_ENV || "development";

console.log("=== Development Seed ===\n");
console.log(`DATABASE_URL: ${maskUrl(DATABASE_URL)}`);
console.log(`NODE_ENV:     ${NODE_ENV}\n`);

function maskUrl(url) {
  if (!url) return "(unset)";
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

// Refuse in production env
if (NODE_ENV === "production") {
  console.error("⛔ Refusing to seed demo data: NODE_ENV=production");
  console.error("Production must only contain real records from real admin actions.");
  process.exit(2);
}

// Refuse if DATABASE_URL looks like Neon production
const isPostgres = DATABASE_URL.startsWith("postgres") || DATABASE_URL.startsWith("postgresql");
const isNeon = /neon|\.tech|\.dev.*postgres|render\.com|supabase|railway|\.aivencloud/i.test(DATABASE_URL);
if (isPostgres && isNeon) {
  console.error("⛔ Refusing to seed demo data: DATABASE_URL points to a Neon/PostgreSQL database.");
  console.error("Seed data should only be inserted into local SQLite for development.");
  console.error("If this is a dedicated dev/staging Neon database, set NODE_ENV=development");
  console.error("and remove this check explicitly from scripts/seed-dev.js.");
  process.exit(2);
}

// Only seed local SQLite in development
if (!DATABASE_URL.startsWith("file:")) {
  console.error("⛔ Refusing to seed: expected SQLite file:// URL for development.");
  process.exit(2);
}

const prisma = new PrismaClient();

async function seed() {
  console.log("Seeding development database...\n");

  // 1. Admin (skip if exists)
  const adminCount = await prisma.admin.count();
  if (adminCount === 0) {
    const passwordHash = await bcrypt.hash("admin12345", 12);
    await prisma.admin.create({
      data: { name: "مدير المدرسة", email: "admin@mustaqbal.school", passwordHash },
    });
    console.log("✓ Created admin: admin@mustaqbal.school / admin12345");
  } else {
    console.log("• Admin already exists — skipping");
  }

  // 2. Settings (skip if exists)
  const settingsCount = await prisma.setting.count();
  if (settingsCount === 0) {
    await prisma.setting.create({ data: {} });
    console.log("✓ Created default settings");
  } else {
    console.log("• Settings already exist — skipping");
  }

  // 3. School year + 2 terms (skip if exists)
  const yearCount = await prisma.schoolYear.count();
  if (yearCount === 0) {
    const year = await prisma.schoolYear.create({
      data: {
        name: "2025/2026",
        startDate: new Date("2025-09-01"),
        endDate: new Date("2026-06-30"),
        isActive: true,
      },
    });
    await prisma.schoolPeriod.createMany({
      data: [
        {
          schoolYearId: year.id,
          name: "الفصل الأول",
          startDate: new Date("2025-09-01"),
          endDate: new Date("2025-12-31"),
          isActive: true,
        },
        {
          schoolYearId: year.id,
          name: "الفصل الثاني",
          startDate: new Date("2026-01-15"),
          endDate: new Date("2026-06-30"),
        },
      ],
    });
    console.log("✓ Created school year 2025/2026 with 2 terms");
  } else {
    console.log("• School years already exist — skipping");
  }

  // 4. Work types (skip if exists)
  const wtCount = await prisma.workType.count();
  if (wtCount === 0) {
    await prisma.workType.createMany({
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
    console.log("✓ Created 10 default work types");
  } else {
    console.log("• Work types already exist — skipping");
  }

  // 5. Demo teachers (skip if any exist)
  const teacherCount = await prisma.teacher.count();
  if (teacherCount === 0) {
    await prisma.teacher.createMany({
      data: [
        { fullName: "أحمد محمد علي", specialization: "رياضيات", subjects: "الجبر، الهندسة", weeklyPeriodCount: 18, employmentStatus: "ACTIVE", employmentStartDate: new Date("2024-09-01") },
        { fullName: "خالد إبراهيم", specialization: "علوم", subjects: "الفيزياء، الكيمياء", weeklyPeriodCount: 16, employmentStatus: "ACTIVE", employmentStartDate: new Date("2023-09-15") },
        { fullName: "سامي عبد الله", specialization: "لغة عربية", subjects: "النحو، الأدب", weeklyPeriodCount: 20, employmentStatus: "ACTIVE", employmentStartDate: new Date("2022-09-01") },
      ],
    });
    console.log("✓ Created 3 demo teachers");
  } else {
    console.log("• Teachers already exist — skipping");
  }

  console.log("\n✓ Seed complete. Login at http://localhost:3000 with admin@mustaqbal.school / admin12345");
}

seed()
  .catch((e) => {
    console.error("\n✗ Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
