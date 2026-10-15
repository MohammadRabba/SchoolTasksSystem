import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

/**
 * POST /api/recurring-assignments/run
 *
 * Triggers generation of pending assignments for all active recurring schedules.
 *
 * For each active recurring assignment, iterates over each scheduled day
 * from lastGeneratedAt (or startDate) through today (UTC), and creates an
 * Assignment + WorkRecords for any day that doesn't already have one.
 *
 * Idempotent: re-running the same day does NOT create duplicates (we check
 * for existing assignments with matching recurringAssignmentId + assignedDate
 * + teacherId before creating).
 *
 * Returns summary: { processed: number, created: number, skipped: number, errors: [] }
 */
export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    // Optionally filter by a specific recurringAssignmentId via query param
    const url = new URL(req.url);
    const targetId = url.searchParams.get("id");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Load active recurring assignments (+ their teacher list + school year)
    const where: any = { isActive: true };
    if (targetId) where.id = targetId;

    const recurringItems = await db.recurringAssignment.findMany({
      where,
      include: {
        teachers: { include: { teacher: true } },
        workType: true,
        schoolYear: true,
        schoolPeriod: true,
      },
    });

    let processed = 0;
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const recurring of recurringItems) {
      processed++;
      try {
        // Determine iteration window: from (lastGeneratedAt or startDate) through min(endDate, today)
        const windowStart = recurring.lastGeneratedAt
          ? new Date(Math.max(recurring.lastGeneratedAt.getTime(), recurring.startDate.getTime()))
          : new Date(recurring.startDate);

        // If the window start is already past today, nothing to generate yet
        if (windowStart.getTime() > todayStart.getTime()) {
          skipped++;
          continue;
        }

        // The window end is the earlier of (today, endDate)
        const windowEnd = new Date(Math.min(recurring.endDate.getTime(), todayStart.getTime()));

        // Parse daysOfWeek depending on frequency
        const days = recurring.daysOfWeek.split(",").map((x) => x.trim()).filter(Boolean);

        // Iterate day-by-day from windowStart through windowEnd (inclusive)
        const cursor = new Date(windowStart);
        const teachers = recurring.teachers.map((t) => t.teacher).filter(Boolean);
        if (teachers.length === 0) {
          skipped++;
          continue;
        }

        while (cursor.getTime() <= windowEnd.getTime()) {
          const shouldGenerate = shouldGenerateForDate(cursor, recurring.frequency, days);
          if (shouldGenerate) {
            // Build assignment for this day
            const assignedDate = new Date(cursor);
            const dueDate = new Date(cursor);
            dueDate.setDate(dueDate.getDate() + recurring.dueOffsetDays);

            // Check if assignment already exists for this recurring + this assignedDate
            const existing = await db.assignment.findFirst({
              where: {
                recurringAssignmentId: recurring.id,
                assignedDate: assignedDate,
              },
            });
            if (existing) {
              // Skip — already generated
            } else {
              // Create assignment + work records for all teachers in a transaction
              await db.$transaction(async (tx) => {
                const a = await tx.assignment.create({
                  data: {
                    title: recurring.title,
                    description: recurring.description,
                    workTypeId: recurring.workTypeId,
                    assignedDate,
                    dueDate,
                    schoolYearId: recurring.schoolYearId,
                    schoolPeriodId: recurring.schoolPeriodId,
                    priority: recurring.priority,
                    assignmentStatus: "ACTIVE",
                    adminInstructions: recurring.adminInstructions,
                    recurringAssignmentId: recurring.id,
                  },
                });
                await tx.workRecord.createMany({
                  data: teachers.map((t) => ({
                    assignmentId: a.id,
                    teacherId: t.id,
                    status: "NOT_STARTED",
                  })),
                });
              });
              created++;
            }
          }
          // Advance by 1 day
          cursor.setDate(cursor.getDate() + 1);
        }

        // Update lastGeneratedAt
        await db.recurringAssignment.update({
          where: { id: recurring.id },
          data: { lastGeneratedAt: now },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`[${recurring.title}] ${msg}`);
      }
    }

    if (created > 0) {
      await writeAuditLog({
        administratorId: admin.id,
        actionType: "AUTO_GENERATE",
        entityType: "RecurringAssignment",
        newValues: { processed, created, skipped, errorsCount: errors.length },
      });
    }

    return NextResponse.json({
      processed,
      created,
      skipped,
      errors,
      runAt: now.toISOString(),
    });
  } catch (e) {
    return apiError(e, "فشل توليد التكليفات التلقائية");
  }
}

/**
 * Returns true if the recurring assignment should generate an assignment
 * for the given date, based on its frequency and daysOfWeek.
 */
function shouldGenerateForDate(
  date: Date,
  frequency: string,
  daysOfWeek: string[]
): boolean {
  if (frequency === "DAILY") {
    // For DAILY: check if the weekday matches any of the selected weekdays
    const dayName = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()];
    return daysOfWeek.includes(dayName);
  }
  if (frequency === "WEEKLY") {
    // For WEEKLY: same logic — generate on the selected weekday(s) each week
    const dayName = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()];
    return daysOfWeek.includes(dayName);
  }
  if (frequency === "MONTHLY") {
    // For MONTHLY: daysOfWeek contains day-of-month numbers (1-31)
    const dayOfMonth = date.getDate();
    return daysOfWeek.some((d) => Number(d) === dayOfMonth);
  }
  return false;
}
