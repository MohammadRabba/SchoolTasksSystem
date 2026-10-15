// Seed missing work types if some are missing
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const existing = await prisma.workType.findMany();
  console.log("Existing work types:", existing.map(w => w.name));
  
  const missing = [
    { name: "تحضير الدروس اليومي", defaultFrequency: "DAILY", defaultCompletionDays: 1, requiresApproval: false },
    { name: "الخطة الفصلية", defaultFrequency: "TERM_BASED", defaultCompletionDays: 14, requiresApproval: true },
    { name: "توزيع المنهج", defaultFrequency: "ANNUAL", defaultCompletionDays: 21, requiresApproval: true },
    { name: "سجل الحضور والغياب", defaultFrequency: "DAILY", defaultCompletionDays: 1, requiresApproval: false },
    { name: "أوراق العمل والاختبارات", defaultFrequency: "MONTHLY", defaultCompletionDays: 7, requiresApproval: true },
    { name: "الملف المهني للمعلم", defaultFrequency: "ANNUAL", defaultCompletionDays: 30, requiresApproval: true },
    { name: "تقارير الأداء الطلابي", defaultFrequency: "MONTHLY", defaultCompletionDays: 7, requiresApproval: true },
    { name: "تقارير إدارية", defaultFrequency: "ONE_TIME", defaultCompletionDays: 3, requiresApproval: true },
  ];
  
  const existingNames = new Set(existing.map(w => w.name));
  const toCreate = missing.filter(w => !existingNames.has(w.name));
  if (toCreate.length > 0) {
    await prisma.workType.createMany({ data: toCreate });
    console.log(`Added ${toCreate.length} work types:`, toCreate.map(w => w.name));
  } else {
    console.log("All work types already exist");
  }
  
  await prisma.$disconnect();
})();
