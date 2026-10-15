import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import ExcelJS from "exceljs";

/**
 * POST /api/assignments/import
 * Form-data: file = xlsx file
 *   Expected columns (Arabic header names):
 *     - العنوان, نوع العمل, تاريخ الاستحقاق, المعلم (اسم أو رقم وظيفي)
 *
 * Returns: { created, skipped, totalRows, invalidRows, errors }
 */
export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
    }

    // Parse Excel
    const buf = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const sheet = wb.worksheets[0];
    if (!sheet) return NextResponse.json({ error: "الملف لا يحتوي على ورقة" }, { status: 400 });

    // Map headers
    const headerMap: Record<number, string> = {};
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const h = String(cell.value || "").trim();
      headerMap[colNumber] = h;
    });

    // Load work types + teachers for lookup
    const [workTypes, teachers, activeYear] = await Promise.all([
      db.workType.findMany({ where: { isActive: true } }),
      db.teacher.findMany({ where: { archivedAt: null } }),
      db.schoolYear.findFirst({ where: { isActive: true } }),
    ]);
    if (!activeYear) {
      return NextResponse.json({ error: "لا يوجد عام دراسي نشط" }, { status: 400 });
    }

    const created: any[] = [];
    const skipped: { row: number; reason: string }[] = [];

    sheet.eachRow(async (row, rowNum) => {
      if (rowNum === 1) return;

      let title = "", workTypeName = "", dueDateStr = "", teacherRef = "";
      row.eachCell((cell, colNumber) => {
        const h = headerMap[colNumber] || "";
        const v = String(cell.value || "").trim();
        if (!v) return;
        if (h.includes("عنوان")) title = v;
        else if (h.includes("نوع")) workTypeName = v;
        else if (h.includes("استحقاق")) dueDateStr = v;
        else if (h.includes("معلم")) teacherRef = v;
      });

      if (!title) {
        skipped.push({ row: rowNum, reason: "العنوان مطلوب" });
        return;
      }
      const wt = workTypes.find((w) => w.name === workTypeName);
      if (!wt) {
        skipped.push({ row: rowNum, reason: `نوع العمل "${workTypeName}" غير موجود` });
        return;
      }
      const dueDate = new Date(dueDateStr);
      if (isNaN(dueDate.getTime())) {
        skipped.push({ row: rowNum, reason: "تاريخ استحقاق غير صالح" });
        return;
      }
      // Find teacher by fullName or employeeNumber
      const teacher = teachers.find(
        (t) => t.fullName === teacherRef || (t.employeeNumber && t.employeeNumber === teacherRef)
      );
      if (!teacher) {
        skipped.push({ row: rowNum, reason: `المعلم "${teacherRef}" غير موجود` });
        return;
      }

      try {
        const a = await db.assignment.create({
          data: {
            title,
            workTypeId: wt.id,
            assignedDate: new Date(),
            dueDate,
            schoolYearId: activeYear.id,
            priority: "NORMAL",
            assignmentStatus: "ACTIVE",
          },
        });
        await db.workRecord.create({
          data: {
            assignmentId: a.id,
            teacherId: teacher.id,
            status: "NOT_STARTED",
          },
        });
        created.push({ id: a.id, title: a.title, teacher: teacher.fullName });
      } catch (e) {
        skipped.push({ row: rowNum, reason: e instanceof Error ? e.message : "خطأ في الإنشاء" });
      }
    });

    // Wait for all rows to process (ExcelJS eachRow is sync — no need to wait)
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "IMPORT",
      entityType: "Assignment",
      newValues: { created: created.length, skipped: skipped.length, totalRows: sheet.rowCount - 1 },
    });

    return NextResponse.json({
      created: created.length,
      skippedCount: skipped.length,
      skipped,
      totalRows: sheet.rowCount - 1,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
