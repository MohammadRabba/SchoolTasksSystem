/**
 * Automated tests for KPI calculation utility functions.
 *
 * These tests verify the pure-function helpers (safePct, formatPct, resolvePeriod)
 * without requiring a database connection. Tests for getReportKPIs/getDashboardMetrics
 * are integration-style and require a seeded DB; they are not included here.
 *
 * Run with: bun test tests/kpi.test.ts
 */

import { safePct, formatPct } from "@/lib/kpi";
import { resolvePeriod, type PeriodKind } from "@/lib/date-utils";

// ============================================================
// Test framework (minimal — no external deps required)
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

function assertEq<T>(actual: T, expected: T, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push(`${label} — expected ${e}, got ${a}`);
    console.error(`✗ ${label} — expected ${e}, got ${a}`);
  }
}

// ============================================================
// safePct tests
// ============================================================

console.log("\n=== safePct ===");
assertEq(safePct(50, 100), 50, "safePct(50, 100) = 50%");
assertEq(safePct(1, 3), (1 / 3) * 100, "safePct(1, 3) ≈ 33.33%");
assertEq(safePct(0, 5), 0, "safePct(0, 5) = 0%");
assertEq(safePct(100, 100), 100, "safePct(100, 100) = 100%");
assertEq(safePct(50, 0), null, "safePct(50, 0) returns null (zero denominator protection)");
assertEq(safePct(0, 0), null, "safePct(0, 0) returns null");

// ============================================================
// formatPct tests
// ============================================================

console.log("\n=== formatPct ===");
assertEq(formatPct(50), "٥٠٪", "formatPct(50) = ٥٠٪");
assertEq(formatPct(33.33), "٣٣٫٣٪", "formatPct(33.33) = ٣٣٫٣٪ (Arabic numerals + Arabic decimal separator, 1 decimal)");
assertEq(formatPct(0), "٠٪", "formatPct(0) = ٠٪");
assertEq(formatPct(100), "١٠٠٪", "formatPct(100) = ١٠٠٪");
assertEq(formatPct(null), "لا توجد بيانات كافية", "formatPct(null) = 'لا توجد بيانات كافية'");
assertEq(formatPct(undefined as unknown as null), "لا توجد بيانات كافية", "formatPct(undefined) = insufficient data");

// ============================================================
// resolvePeriod tests
// ============================================================

console.log("\n=== resolvePeriod ===");

// TODAY: returns same start-of-day boundaries
const today = resolvePeriod({ kind: "TODAY" });
const now = new Date();
const expectedTodayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
assert(today.start.getTime() === expectedTodayStart.getTime(), "TODAY start = start of day");
assert(today.end.getTime() >= today.start.getTime(), "TODAY end >= start");
assert(today.end.getTime() - today.start.getTime() === 24 * 60 * 60 * 1000 - 1, "TODAY duration = 24h - 1ms");

// WEEK: starts on Sunday
const week = resolvePeriod({ kind: "WEEK" });
assert(week.start.getDay() === 0, "WEEK start = Sunday");
assert(week.end.getTime() - week.start.getTime() === 7 * 24 * 60 * 60 * 1000 - 1, "WEEK duration = 7 days - 1ms");

// MONTH: starts on 1st, ends on last day of month
const month = resolvePeriod({ kind: "MONTH" });
assert(month.start.getDate() === 1, "MONTH start = 1st of month");
assert(month.start.getMonth() === now.getMonth(), "MONTH start month = current month");
assert(month.end.getMonth() === now.getMonth(), "MONTH end month = current month");

// TERM with explicit dates
const termExplicit = resolvePeriod(
  { kind: "TERM" },
  { termStart: "2025-09-01", termEnd: "2025-12-31" }
);
assertEq(termExplicit.start.toISOString().split("T")[0], "2025-09-01", "TERM explicit start");
assertEq(termExplicit.end.toISOString().split("T")[0], "2025-12-31", "TERM explicit end");

// TERM without explicit (fallback to current month)
const termFallback = resolvePeriod({ kind: "TERM" });
assert(termFallback.start.getDate() === 1, "TERM fallback start = 1st of current month");
assert(termFallback.end.getMonth() === now.getMonth(), "TERM fallback end = current month");

// YEAR with explicit dates
const yearExplicit = resolvePeriod(
  { kind: "YEAR" },
  { yearStart: "2025-09-01", yearEnd: "2026-06-30" }
);
assertEq(yearExplicit.start.toISOString().split("T")[0], "2025-09-01", "YEAR explicit start");
assertEq(yearExplicit.end.toISOString().split("T")[0], "2026-06-30", "YEAR explicit end");

// ============================================================
// PeriodKind enum coverage
// ============================================================

console.log("\n=== PeriodKind coverage ===");
const allKinds: PeriodKind[] = ["TODAY", "WEEK", "MONTH", "TERM", "YEAR", "CUSTOM"];
for (const kind of allKinds) {
  const r = resolvePeriod({ kind });
  assert(r.start instanceof Date && r.end instanceof Date, `resolvePeriod(${kind}) returns Date objects`);
  assert(r.end.getTime() >= r.start.getTime(), `resolvePeriod(${kind}): end >= start`);
}

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
  console.log(`\n✓ All KPI unit tests passed.`);
  process.exit(0);
}
