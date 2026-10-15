import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

/**
 * POST /api/reports/custom
 * Body: { columns, filters, format }
 *   columns: string[] — which columns to include
 *   filters: { start?, end?, teacherId?, workTypeId?, status?, priority? }
 *   format: "json" | "excel" (currently returns JSON; excel is via /api/reports/export)
 */
const CustomReportSchema = z.object({
  columns: z.array(z.string()).min(1),
  filters: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    teacherId: z.string().optional(),
    workTypeId: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    schoolYearId: z.string().optional(),
  }).default({}),
  format: z.enum(["json", "excel"]).default("json"),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = CustomReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const { columns, filters, format } = parsed.data;

    // Build the where clause
    const where: any = {
      assignment: {
        ...(filters.start && filters.end
          ? { dueDate: { gte: new Date(filters.start), lte: new Date(filters.end + "T23:59:59") } }
          : {}),
        ...(filters.workTypeId ? { workTypeId: filters.workTypeId } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.schoolYearId ? { schoolYearId: filters.schoolYearId } : {}),
        assignmentStatus: "ACTIVE",
        archivedAt: null,
      },
      status: { not: "CANCELLED" },
      ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const records = await db.workRecord.findMany({
      where,
      include: {
        teacher: { select: { id: true, fullName: true, specialization: true, employeeNumber: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            description: true,
            assignedDate: true,
            dueDate: true,
            priority: true,
            assignmentStatus: true,
            workType: { select: { id: true, name: true } },
            schoolYear: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { assignment: { dueDate: "asc" } },
      take: 2000,
    });

    // Project columns only
    const projected = records.map((r) => {
      const out: any = {};
      for (const col of columns) {
        switch (col) {
          case "teacherName": out.teacherName = r.teacher?.fullName; break;
          case "employeeNumber": out.employeeNumber = r.teacher?.employeeNumber; break;
          case "specialization": out.specialization = r.teacher?.specialization; break;
          case "assignmentTitle": out.assignmentTitle = r.assignment.title; break;
          case "assignmentDescription": out.assignmentDescription = r.assignment.description; break;
          case "workType": out.workType = r.assignment.workType?.name; break;
          case "assignedDate": out.assignedDate = r.assignment.assignedDate; break;
          case "dueDate": out.dueDate = r.assignment.dueDate; break;
          case "status": out.status = r.status; break;
          case "priority": out.priority = r.assignment.priority; break;
          case "completionDate": out.completionDate = r.completionDate; break;
          case "approvedAt": out.approvedAt = r.approvedAt; break;
          case "schoolYear": out.schoolYear = r.assignment.schoolYear?.name; break;
          case "administrativeNotes": out.administrativeNotes = r.administrativeNotes; break;
          case "revisionNotes": out.revisionNotes = r.revisionNotes; break;
        }
      }
      return out;
    });

    return NextResponse.json({
      columns,
      filters,
      totalRecords: projected.length,
      records: projected,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
