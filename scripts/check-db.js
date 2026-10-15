// Quick script to check DB state and create a test admin
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

(async () => {
  const adminCount = await prisma.admin.count();
  console.log("Admin count:", adminCount);
  
  if (adminCount === 0) {
    const hash = await bcrypt.hash("admin12345", 12);
    await prisma.admin.create({
      data: { name: "مدير المدرسة", email: "admin@mustaqbal.school", passwordHash: hash }
    });
    console.log("Created test admin: admin@mustaqbal.school / admin12345");
  } else {
    const admins = await prisma.admin.findMany();
    console.log("Existing admins:", admins.map(a => a.email));
  }
  
  const settings = await prisma.setting.count();
  console.log("Settings:", settings);
  const years = await prisma.schoolYear.count();
  console.log("School years:", years);
  const wt = await prisma.workType.count();
  console.log("Work types:", wt);
  
  await prisma.$disconnect();
})();
