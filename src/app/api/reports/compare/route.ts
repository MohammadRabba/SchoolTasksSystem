import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/reports/compare?schoolYearId=xxx
 * Returns term-vs-term + year-vs-year comparison data
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const schoolYearId = url.searchParams.get("schoolYearId");

    let activeYear: any = null;
    if (schoolYearId) {
      activeYear = await db.schoolYear.findUnique({ where: { id: schoolYearId }, include: { terms: true } });
    } else {
      activeYear = await db.schoolYear.findFirst({
        where: { isActive: true },
        include: { terms: true },
      });
    }
    if (!activeYear) {
      return NextResponse.json({ error: "لا يوجد عام دراسي محدد" }, { status: 404 });
    }

    // Compare each term in this year
    const termComparisons: any[] = [];
    for (const term of activeYear.terms) {
      const records = await db.workRecord.findMany({
        where: {
          assignment: {
            dueDate: { gte: term.startDate, lte: term.endDate },
            assignmentStatus: "ACTIVE",
            archivedAt: null,
            schoolYearId: activeYear.id,
          },
          status: { not: "CANCELLED" },
        },
        include: { assignment: true },
      });
      const total = records.length;
      const completed = records.filter((r) => ["SUBMITTED", "COMPLETED", "APPROVED"].includes(r.status)).length;
      const approved = records.filter((r) => r.status === "APPROVED").length;
      const overdue = records.filter(
        (r) =>
          ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status) &&
          r.assignment.dueDate.getTime() < Date.now()
      ).length;
      termComparisons.push({
        termId: term.id,
        termName: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
        total,
        completed,
        approved,
        overdue,
        completionRate: total ? (completed / total) * 100 : null,
        approvalRate: total ? (approved / total) * 100 : null,
        overdueRate: total ? (overdue / total) * 100 : null,
      });
    }

    // Compare with previous school year (if any)
    const previousYear = await db.schoolYear.findFirst({
      where: { endDate: { lt: activeYear.startDate } },
      orderBy: { endDate: "desc" },
    });

    let yearComparison: any = null;
    if (previousYear) {
      const currentRecords = await db.workRecord.findMany({
        where: {
          assignment: {
            dueDate: { gte: activeYear.startDate, lte: activeYear.endDate },
            assignmentStatus: "ACTIVE",
            archivedAt: null,
            schoolYearId: activeYear.id,
          },
          status: { not: "CANCELLED" },
        },
        include: { assignment: true },
      });
      const previousRecords = await db.workRecord.findMany({
        where: {
          assignment: {
            dueDate: { gte: previousYear.startDate, lte: previousYear.endDate },
            assignmentStatus: "ACTIVE",
            schoolYearId: previousYear.id,
          },
          status: { not: "CANCELLED" },
        },
        include: { assignment: true },
      });
      const calc = (records: any[]) => {
        const total = records.length;
        const completed = records.filter((r) => ["SUBMITTED", "COMPLETED", "APPROVED"].includes(r.status)).length;
        const overdue = records.filter(
          (r) =>
            ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status) &&
            r.assignment.dueDate.getTime() < Date.now()
        ).length;
        return {
          total,
          completed,
          overdue,
          completionRate: total ? (completed / total) * 100 : null,
          overdueRate: total ? (overdue / total) * 100 : null,
        };
      };
      yearComparison = {
        current: { yearName: activeYear.name, ...calc(currentRecords) },
        previous: { yearName: previousYear.name, ...calc(previousRecords) },
      };
    }

    return NextResponse.json({
      schoolYear: { id: activeYear.id, name: activeYear.name },
      termComparisons,
      yearComparison,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
