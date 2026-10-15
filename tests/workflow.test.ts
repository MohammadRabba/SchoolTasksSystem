/**
 * Automated tests for work record workflow logic.
 *
 * Tests the business rules for:
 *   - Overdue status calculation (only when due date passed AND status in active set)
 *   - Cancelled assignment exclusion from eligible workload
 *   - Approved vs completed vs submitted distinction
 *   - Approval rate computation (only approved, not submitted/completed)
 *
 * These tests use a pure-function reimplementation of the rules from src/lib/kpi.ts
 * to avoid requiring a DB. If the rules in kpi.ts change, update these tests accordingly.
 *
 * Run with: bun test tests/workflow.test.ts
 */

// Pure helpers duplicating the rules from src/lib/kpi.ts for testing
const OVERDUE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"];
const COMPLETED_STATUSES = ["SUBMITTED", "COMPLETED", "APPROVED"];
const ACTIVE_ASSIGNMENT_STATUSES = ["ACTIVE"];

interface FakeWorkRecord {
  status: string;
  completionDate?: Date | null;
  assignment: {
    dueDate: Date;
    assignedDate: Date;
    assignmentStatus: string;
  };
}

function isOverdue(record: FakeWorkRecord, now: Date): boolean {
  if (!OVERDUE_STATUSES.includes(record.status)) return false;
  if (!ACTIVE_ASSIGNMENT_STATUSES.includes(record.assignment.assignmentStatus)) return false;
  return record.assignment.dueDate.getTime() < now.getTime();
}

function isCompleted(record: FakeWorkRecord): boolean {
  return COMPLETED_STATUSES.includes(record.status);
}

function isApproved(record: FakeWorkRecord): boolean {
  return record.status === "APPROVED";
}

function isEligible(record: FakeWorkRecord): boolean {
  return (
    ACTIVE_ASSIGNMENT_STATUSES.includes(record.assignment.assignmentStatus) &&
    record.status !== "CANCELLED"
  );
}

function isOnTime(record: FakeWorkRecord): boolean {
  if (!isCompleted(record)) return false;
  if (!record.completionDate) return false;
  return record.completionDate.getTime() <= record.assignment.dueDate.getTime();
}

// ============================================================
// Test framework
// ============================================================

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

// ============================================================
// Build test fixtures
// ============================================================

const now = new Date("2026-01-15T12:00:00Z");
const pastDate = new Date("2026-01-10T00:00:00Z");
const futureDate = new Date("2026-01-20T00:00:00Z");
const earlyAssigned = new Date("2026-01-05T00:00:00Z");

function makeRecord(status: string, dueDate: Date, opts?: Partial<FakeWorkRecord>): FakeWorkRecord {
  return {
    status,
    completionDate: null,
    assignment: {
      dueDate,
      assignedDate: earlyAssigned,
      assignmentStatus: "ACTIVE",
    },
    ...opts,
  };
}

// ============================================================
// Tests: overdue calculation
// ============================================================

console.log("\n=== Overdue rules ===");

// NOT_STARTED, past due → overdue
assert(isOverdue(makeRecord("NOT_STARTED", pastDate), now) === true, "NOT_STARTED past due = overdue");

// IN_PROGRESS, past due → overdue
assert(isOverdue(makeRecord("IN_PROGRESS", pastDate), now) === true, "IN_PROGRESS past due = overdue");

// NEEDS_REVISION, past due → overdue
assert(isOverdue(makeRecord("NEEDS_REVISION", pastDate), now) === true, "NEEDS_REVISION past due = overdue");

// SUBMITTED, past due → NOT overdue (per spec)
assert(isOverdue(makeRecord("SUBMITTED", pastDate), now) === false, "SUBMITTED past due = NOT overdue");

// COMPLETED, past due → NOT overdue
assert(isOverdue(makeRecord("COMPLETED", pastDate), now) === false, "COMPLETED past due = NOT overdue");

// APPROVED, past due → NOT overdue
assert(isOverdue(makeRecord("APPROVED", pastDate), now) === false, "APPROVED past due = NOT overdue");

// REJECTED, past due → NOT overdue
assert(isOverdue(makeRecord("REJECTED", pastDate), now) === false, "REJECTED past due = NOT overdue");

// NOT_STARTED but future due → NOT overdue
assert(isOverdue(makeRecord("NOT_STARTED", futureDate), now) === false, "NOT_STARTED future due = NOT overdue");

// Cancelled assignment + NOT_STARTED past due → NOT overdue (assignment not active)
assert(
  isOverdue(
    makeRecord("NOT_STARTED", pastDate, { assignment: { dueDate: pastDate, assignedDate: earlyAssigned, assignmentStatus: "CANCELLED" } }),
    now
  ) === false,
  "NOT_STARTED past due + CANCELLED assignment = NOT overdue"
);

// NOT_STARTED past due + COMPLETED assignment → NOT overdue
assert(
  isOverdue(
    makeRecord("NOT_STARTED", pastDate, { assignment: { dueDate: pastDate, assignedDate: earlyAssigned, assignmentStatus: "COMPLETED" } }),
    now
  ) === false,
  "NOT_STARTED past due + COMPLETED assignment = NOT overdue"
);

// ============================================================
// Tests: cancellation exclusion
// ============================================================

console.log("\n=== Cancellation exclusion ===");

assert(isEligible(makeRecord("NOT_STARTED", futureDate)) === true, "NOT_STARTED + ACTIVE = eligible");
assert(isEligible(makeRecord("CANCELLED", futureDate)) === false, "CANCELLED status = NOT eligible");
assert(
  isEligible(makeRecord("COMPLETED", futureDate, { assignment: { dueDate: futureDate, assignedDate: earlyAssigned, assignmentStatus: "CANCELLED" } })) === false,
  "COMPLETED + CANCELLED assignment = NOT eligible"
);

// ============================================================
// Tests: completed vs submitted vs approved
// ============================================================

console.log("\n=== Submission != Approval ===");

assert(isCompleted(makeRecord("SUBMITTED", futureDate)) === true, "SUBMITTED counts as completed (per spec — submission IS completion)");
assert(isCompleted(makeRecord("COMPLETED", futureDate)) === true, "COMPLETED counts as completed");
assert(isCompleted(makeRecord("APPROVED", futureDate)) === true, "APPROVED counts as completed");
assert(isCompleted(makeRecord("IN_PROGRESS", futureDate)) === false, "IN_PROGRESS NOT counted as completed");
assert(isCompleted(makeRecord("NOT_STARTED", futureDate)) === false, "NOT_STARTED NOT counted as completed");
assert(isCompleted(makeRecord("NEEDS_REVISION", futureDate)) === false, "NEEDS_REVISION NOT counted as completed");

assert(isApproved(makeRecord("APPROVED", futureDate)) === true, "APPROVED is approved");
assert(isApproved(makeRecord("SUBMITTED", futureDate)) === false, "SUBMITTED is NOT approved (submission != approval)");
assert(isApproved(makeRecord("COMPLETED", futureDate)) === false, "COMPLETED is NOT approved (completion != approval)");

// ============================================================
// Tests: on-time completion
// ============================================================

console.log("\n=== On-time completion ===");

const beforeDue = new Date("2026-01-09T00:00:00Z"); // before pastDate (Jan 10)
const afterDue = new Date("2026-01-11T00:00:00Z"); // after pastDate

assert(
  isOnTime(makeRecord("COMPLETED", pastDate, { completionDate: beforeDue })) === true,
  "COMPLETED before due date = on-time"
);
assert(
  isOnTime(makeRecord("COMPLETED", pastDate, { completionDate: afterDue })) === false,
  "COMPLETED after due date = NOT on-time"
);
assert(
  isOnTime(makeRecord("COMPLETED", pastDate, { completionDate: pastDate })) === true,
  "COMPLETED exactly on due date = on-time (boundary inclusive)"
);
assert(
  isOnTime(makeRecord("IN_PROGRESS", pastDate, { completionDate: beforeDue })) === false,
  "IN_PROGRESS (not completed) = NOT on-time"
);
assert(
  isOnTime(makeRecord("COMPLETED", pastDate, { completionDate: null })) === false,
  "COMPLETED with null completionDate = NOT on-time"
);

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
  console.log(`\n✓ All workflow tests passed.`);
  process.exit(0);
}
