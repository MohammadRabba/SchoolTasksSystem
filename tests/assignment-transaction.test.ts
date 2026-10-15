/**
 * Integration test: Multi-teacher assignment creation with transaction.
 *
 * Verifies that:
 *   - Creating an assignment with N teachers creates exactly N work records
 *   - All work records have status NOT_STARTED initially
 *   - All work records have the same assignmentId
 *   - If one creation fails (e.g., duplicate teacher), the transaction rolls back
 *     and NO assignment OR work records are left behind
 *
 * Requires:
 *   - DATABASE_URL pointing to a test database (SQLite file in test mode)
 *   - The schema must be pushed before running: `bun run db:push`
 *
 * Run with: bun test tests/assignment-transaction.test.ts
 */

import { PrismaClient } from "@prisma/client";

// Use a separate test DB
const TEST_DB_URL = process.env.TEST_DATABASE_URL || "file:/home/z/my-project/db/test.db";

// Override env before instantiating client
process.env.DATABASE_URL = TEST_DB_URL;

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: boolean, label: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    console.error(`✗ ${label}`);
  }
}

async function setup() {
  // Push schema to test DB if needed
  // This is done externally via `bun run db:push` against TEST_DATABASE_URL
  // We just clean the tables here for a fresh test
  await prisma.review.deleteMany();
  await prisma.workRecord.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.workType.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.setting.deleteMany();
}

async function main() {
  await setup();

  // Create supporting records
  const admin = await prisma.admin.create({
    data: { name: "Test Admin", email: "test-admin@school.local", passwordHash: "x" },
  });

  const settings = await prisma.setting.create({ data: {} });

  const year = await prisma.schoolYear.create({
    data: { name: "2025/2026", startDate: new Date("2025-09-01"), endDate: new Date("2026-06-30"), isActive: true },
  });

  const workType = await prisma.workType.create({
    data: { name: "تحضير الدروس اليومي", defaultFrequency: "DAILY", defaultCompletionDays: 1, requiresApproval: false },
  });

  // Create 3 teachers
  const teachers = await Promise.all([
    prisma.teacher.create({ data: { fullName: "المعلم الأول" } }),
    prisma.teacher.create({ data: { fullName: "المعلم الثاني" } }),
    prisma.teacher.create({ data: { fullName: "المعلم الثالث" } }),
  ]);

  // ============================================================
  // Test 1: Multi-teacher assignment creates 1 assignment + 3 work records
  // ============================================================

  console.log("\n=== Test 1: Multi-teacher assignment creation ===");
  const teacherIds = teachers.map((t) => t.id);
  const beforeAssignments = await prisma.assignment.count();
  const beforeWorkRecords = await prisma.workRecord.count();

  const assignment = await prisma.$transaction(async (tx) => {
    const a = await tx.assignment.create({
      data: {
        title: "تقرير اختبار",
        workTypeId: workType.id,
        assignedDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        schoolYearId: year.id,
        priority: "NORMAL",
        assignmentStatus: "ACTIVE",
      },
    });
    await tx.workRecord.createMany({
      data: teacherIds.map((teacherId) => ({
        assignmentId: a.id,
        teacherId,
        status: "NOT_STARTED",
      })),
    });
    return a;
  });

  const afterAssignments = await prisma.assignment.count();
  const afterWorkRecords = await prisma.workRecord.count();

  assert(afterAssignments - beforeAssignments === 1, "Creates exactly 1 assignment");
  assert(afterWorkRecords - beforeWorkRecords === 3, "Creates exactly 3 work records (one per teacher)");

  const records = await prisma.workRecord.findMany({ where: { assignmentId: assignment.id } });
  assert(records.length === 3, "Work records fetched = 3");
  assert(records.every((r) => r.status === "NOT_STARTED"), "All records start as NOT_STARTED");
  assert(
    new Set(records.map((r) => r.teacherId)).size === 3,
    "Each work record has a distinct teacherId"
  );
  assert(
    records.every((r) => r.assignmentId === assignment.id),
    "All work records reference the new assignment"
  );

  // ============================================================
  // Test 2: Transaction rollback on failure
  // ============================================================

  console.log("\n=== Test 2: Transaction rollback on failure ===");
  const beforeAssignments2 = await prisma.assignment.count();
  const beforeWorkRecords2 = await prisma.workRecord.count();

  // Trigger a failure by passing an invalid teacherId inside the transaction
  let threw = false;
  try {
    await prisma.$transaction(async (tx) => {
      const a = await tx.assignment.create({
        data: {
          title: "تقرير سيفشل",
          workTypeId: workType.id,
          assignedDate: new Date(),
          dueDate: new Date(),
          schoolYearId: year.id,
          priority: "NORMAL",
          assignmentStatus: "ACTIVE",
        },
      });
      // This will fail because of the foreign key constraint
      await tx.workRecord.createMany({
        data: [
          { assignmentId: a.id, teacherId: "non-existent-teacher-id", status: "NOT_STARTED" },
        ],
      });
    });
  } catch (e) {
    threw = true;
  }

  assert(threw, "Transaction with invalid teacherId throws");

  const afterAssignments2 = await prisma.assignment.count();
  const afterWorkRecords2 = await prisma.workRecord.count();

  assert(afterAssignments2 === beforeAssignments2, "After rollback: no new assignments");
  assert(afterWorkRecords2 === beforeWorkRecords2, "After rollback: no new work records");

  // Verify the failed assignment doesn't exist
  const failedAssignment = await prisma.assignment.findFirst({ where: { title: "تقرير سيفشل" } });
  assert(failedAssignment === null, "Failed assignment does NOT persist (rolled back)");

  // ============================================================
  // Cleanup
  // ============================================================

  console.log("\n=== Cleanup ===");
  await prisma.review.deleteMany();
  await prisma.workRecord.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.workType.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.setting.deleteMany();

  await prisma.$disconnect();

  // ============================================================
  // Summary
  // ============================================================

  console.log(`\n=== Summary ===`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log(`\n✓ All assignment transaction tests passed.`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error("Test runner error:", e);
  process.exit(1);
});
