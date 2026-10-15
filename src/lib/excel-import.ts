import ExcelJS from "exceljs";

// ============================================================
// Teacher Excel Import — parse uploaded file
// ============================================================

export interface ParsedTeacherRow {
  rowIndex: number;
  employeeNumber?: string;
  fullName?: string;
  specialization?: string;
  subjects?: string;
  weeklyPeriodCount?: number;
  employmentStartDate?: string;
  employmentStatus?: string;
  administrativeNotes?: string;
  valid: boolean;
  errors: string[];
}

export interface ParseResult {
  rows: ParsedTeacherRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
}

/**
 * Parse an uploaded Excel file of teacher rows.
 * Expected Arabic columns (in any order, mapped by header):
 *   - الاسم الكامل / الاسم
 *   - الرقم الوظيفي
 *   - التخصص
 *   - المواد
 *   - عدد الحصص الأسبوعية
 *   - تاريخ بدء العمل
 *   - الحالة الوظيفية
 *   - ملاحظات
 */
export async function parseTeacherImport(buffer: ArrayBuffer): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheet = wb.worksheets[0];
  if (!sheet) {
    return { rows: [], totalRows: 0, validCount: 0, invalidCount: 0 };
  }

  // Map header row to columns
  const headerMap: Record<number, string> = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const h = String(cell.value || "").trim();
    headerMap[colNumber] = h;
  });

  const rows: ParsedTeacherRow[] = [];
  let dataRowCount = 0;

  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // skip header

    const parsed: ParsedTeacherRow = {
      rowIndex: rowNum,
      errors: [],
      valid: true,
    };

    row.eachCell((cell, colNumber) => {
      const header = headerMap[colNumber];
      if (!header) return;
      const value = String(cell.value || "").trim();
      if (!value) return;

      if (header.includes("اسم")) parsed.fullName = value;
      else if (header.includes("رقم")) parsed.employeeNumber = value;
      else if (header.includes("تخصص")) parsed.specialization = value;
      else if (header.includes("مواد")) parsed.subjects = value;
      else if (header.includes("حصص")) {
        const n = Number(value);
        if (!isNaN(n)) parsed.weeklyPeriodCount = n;
      } else if (header.includes("تاريخ")) parsed.employmentStartDate = value;
      else if (header.includes("حالة")) {
        const upper = value.toUpperCase();
        if (upper.includes("خدمة") || upper.includes("ACTIVE")) parsed.employmentStatus = "ACTIVE";
        else if (upper.includes("إجازة") || upper.includes("LEAVE")) parsed.employmentStatus = "ON_LEAVE";
        else if (upper.includes("غير") || upper.includes("INACTIVE")) parsed.employmentStatus = "INACTIVE";
      } else if (header.includes("ملاحظات")) parsed.administrativeNotes = value;
    });

    // Skip rows that are clearly template examples or notes
    // (matches "مثال:" prefix and "ملاحظة:" prefix — both are template annotations)
    if (parsed.fullName && (parsed.fullName.startsWith("مثال:") || parsed.fullName.startsWith("ملاحظة:"))) {
      return; // skip this row entirely — it's a template annotation
    }

    dataRowCount++;

    // Validation
    if (!parsed.fullName) {
      parsed.errors.push("الاسم مطلوب");
      parsed.valid = false;
    } else if (parsed.fullName.length > 100) {
      // Sanity limit: real names don't exceed 100 chars
      parsed.errors.push("الاسم طويل جدًا (أكثر من 100 حرف) — يُحتمل أنه نص توضيحي وليس اسمًا");
      parsed.valid = false;
    }
    if (parsed.employmentStartDate && isNaN(new Date(parsed.employmentStartDate).getTime())) {
      parsed.errors.push("تاريخ بدء العمل غير صالح");
      parsed.valid = false;
    }

    rows.push(parsed);
  });

  return {
    rows,
    totalRows: dataRowCount,
    validCount: rows.filter((r) => r.valid).length,
    invalidCount: rows.filter((r) => !r.valid).length,
  };
}

// ============================================================
// Teacher Excel Template — downloadable empty template
// ============================================================

export async function buildTeacherTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "نظام إدارة المدرسة";
  wb.created = new Date();

  const sheet = wb.addWorksheet("قالب استيراد المعلمين", {
    views: [{ rightToLeft: true }],
  });

  sheet.columns = [
    { header: "الاسم الكامل", key: "fullName", width: 30 },
    { header: "الرقم الوظيفي", key: "employeeNumber", width: 18 },
    { header: "التخصص", key: "specialization", width: 25 },
    { header: "المواد", key: "subjects", width: 30 },
    { header: "عدد الحصص الأسبوعية", key: "weeklyPeriodCount", width: 18 },
    { header: "تاريخ بدء العمل", key: "employmentStartDate", width: 18 },
    { header: "الحالة الوظيفية", key: "employmentStatus", width: 18 },
    { header: "ملاحظات", key: "administrativeNotes", width: 30 },
  ];

  // Bold header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };

  // Add 3 sample rows (Arabic placeholders)
  sheet.addRow({
    fullName: "مثال: أحمد محمد علي",
    employeeNumber: "EMP-001",
    specialization: "رياضيات",
    subjects: "الجبر، الهندسة",
    weeklyPeriodCount: 18,
    employmentStartDate: "2024-09-01",
    employmentStatus: "في الخدمة",
    administrativeNotes: "",
  });
  sheet.addRow({
    fullName: "مثال: خالد إبراهيم",
    employeeNumber: "EMP-002",
    specialization: "علوم",
    subjects: "الفيزياء، الكيمياء",
    weeklyPeriodCount: 16,
    employmentStartDate: "2023-09-15",
    employmentStatus: "في الخدمة",
    administrativeNotes: "",
  });

  // Notes row
  sheet.addRow({});
  sheet.addRow({
    fullName:
      "ملاحظة: يجب أن تحتوي أول ورقة على هذه الأعمدة بالترتيب أو بأي ترتيب مع الحفاظ على رؤوس الأعمدة أعلاه.",
  });
  sheet.getRow(sheet.rowCount).font = { italic: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
