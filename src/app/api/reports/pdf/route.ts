import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getReportKPIs } from "@/lib/kpi";

/**
 * GET /api/reports/pdf?type=monthly&start=...&end=...
 *
 * Returns print-optimized HTML that auto-opens the browser's print dialog.
 * The browser can then "Save as PDF" — this is the most reliable way to
 * produce Arabic PDFs without fighting fontkit/font embedding issues.
 *
 * The HTML uses Arabic-supporting fonts (Cairo via Google Fonts CDN, falls back
 * to DejaVu Sans which is installed locally) and RTL layout. When printed,
 * it produces a clean, professional PDF that's identical to the on-screen view.
 */
export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "monthly") as "monthly" | "school";
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "start و end مطلوبان" }, { status: 400 });
    }

    const range = { start: new Date(start), end: new Date(end + "T23:59:59") };

    // Fetch data
    const [settings, kpis, records, substitutions, departures] = await Promise.all([
      db.setting.findFirst(),
      getReportKPIs(range),
      db.workRecord.findMany({
        where: {
          assignment: {
            dueDate: { gte: range.start, lte: range.end },
            assignmentStatus: "ACTIVE",
            archivedAt: null,
          },
          status: { not: "CANCELLED" },
        },
        include: {
          teacher: { select: { fullName: true, specialization: true } },
          assignment: { include: { workType: { select: { name: true } } } },
        },
        orderBy: { assignment: { dueDate: "asc" } },
        take: 500,
      }),
      db.substitution.findMany({
        where: { substitutionDate: { gte: range.start, lte: range.end } },
        include: {
          originalTeacher: { select: { fullName: true } },
          substituteTeacher: { select: { fullName: true } },
        },
        take: 200,
      }),
      db.departure.findMany({
        where: { departureDate: { gte: range.start, lte: range.end } },
        include: { teacher: { select: { fullName: true } } },
        take: 200,
      }),
    ]);

    const schoolName = settings?.schoolNameAr || "مدرسة ذكور المستقبل الصالح الأساسية العليا";
    const startDate = range.start.toLocaleDateString("ar-EG");
    const endDate = range.end.toLocaleDateString("ar-EG");
    const today = new Date().toLocaleString("ar-EG");

    // Build HTML
    const recordsRows = records.slice(0, 50).map((r) => `
      <tr>
        <td>${escapeHtml(r.teacher?.fullName || "—")}</td>
        <td>${escapeHtml(r.assignment.title)}</td>
        <td>${escapeHtml(r.assignment.workType?.name || "—")}</td>
        <td>${new Date(r.assignment.dueDate).toLocaleDateString("ar-EG")}</td>
        <td>${escapeHtml(r.status)}</td>
      </tr>
    `).join("");

    const subRows = substitutions.slice(0, 30).map((s) => `
      <tr>
        <td>${new Date(s.substitutionDate).toLocaleDateString("ar-EG")}</td>
        <td>${escapeHtml(s.className)} ${s.sectionName ? `(${escapeHtml(s.sectionName)})` : ""}</td>
        <td>${escapeHtml(s.originalTeacher?.fullName || "—")}</td>
        <td>${escapeHtml(s.substituteTeacher?.fullName || "غير معين")}</td>
      </tr>
    `).join("");

    const depRows = departures.slice(0, 30).map((d) => `
      <tr>
        <td>${new Date(d.departureDate).toLocaleDateString("ar-EG")}</td>
        <td>${escapeHtml(d.teacher?.fullName || "—")}</td>
        <td>${escapeHtml(d.departureTime)}</td>
        <td>${escapeHtml(d.returnTime || "—")}</td>
        <td>${escapeHtml(d.departureType)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير ${escapeHtml(schoolName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 1.5cm; }
    body { font-family: 'Cairo', 'DejaVu Sans', 'Noto Sans Arabic', sans-serif; font-size: 11pt; color: #1a1a1a; direction: rtl; }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 4pt; color: #1e3a8a; }
    h2 { font-size: 13pt; margin-top: 16pt; margin-bottom: 6pt; color: #1e40af; border-bottom: 1px solid #1e40af; padding-bottom: 2pt; }
    .subtitle { text-align: center; font-size: 10pt; color: #555; margin-bottom: 4pt; }
    .period { text-align: center; font-size: 10pt; color: #555; margin-bottom: 12pt; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9pt; }
    th { background: #f1f5f9; padding: 6pt 4pt; text-align: right; border: 1px solid #cbd5e1; font-weight: bold; }
    td { padding: 4pt; border: 1px solid #cbd5e1; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 12pt 0; }
    .kpi { border: 1px solid #cbd5e1; padding: 8pt; text-align: center; border-radius: 4pt; background: #f8fafc; }
    .kpi-value { font-size: 18pt; font-weight: bold; color: #1e40af; }
    .kpi-label { font-size: 9pt; color: #555; }
    .footer { margin-top: 24pt; padding-top: 8pt; border-top: 1px solid #cbd5e1; font-size: 8pt; color: #777; text-align: center; }
    .overdue { color: #dc2626; font-weight: bold; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body onload="window.print()">
  <div class="no-print" style="position:fixed;top:8pt;left:8pt;z-index:100;background:#1e40af;color:white;padding:8pt 12pt;border-radius:4pt;cursor:pointer" onclick="window.print()">
    طباعة / حفظ PDF
  </div>
  <h1>${escapeHtml(schoolName)}</h1>
  <div class="subtitle">تقرير ${type === "monthly" ? "شهري" : "أداء عام"}</div>
  <div class="period">الفترة: ${startDate} — ${endDate}</div>

  <h2>مؤشرات الأداء</h2>
  <div class="kpis">
    <div class="kpi"><div class="kpi-value">${kpis.totalEligible}</div><div class="kpi-label">إجمالي الأعمال</div></div>
    <div class="kpi"><div class="kpi-value">${kpis.completed}</div><div class="kpi-label">مكتملة</div></div>
    <div class="kpi"><div class="kpi-value">${kpis.approved}</div><div class="kpi-label">معتمدة</div></div>
    <div class="kpi"><div class="kpi-value overdue">${kpis.overdue}</div><div class="kpi-label">متأخرة</div></div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-value">${kpis.completionRate !== null ? kpis.completionRate.toFixed(1) + "%" : "—"}</div><div class="kpi-label">نسبة الإكمال</div></div>
    <div class="kpi"><div class="kpi-value">${kpis.approvalRate !== null ? kpis.approvalRate.toFixed(1) + "%" : "—"}</div><div class="kpi-label">نسبة الاعتماد</div></div>
    <div class="kpi"><div class="kpi-value">${kpis.onTimeCompletionRate !== null ? kpis.onTimeCompletionRate.toFixed(1) + "%" : "—"}</div><div class="kpi-label">نسبة الإكمال في الوقت</div></div>
    <div class="kpi"><div class="kpi-value overdue">${kpis.overdueRate !== null ? kpis.overdueRate.toFixed(1) + "%" : "—"}</div><div class="kpi-label">نسبة التأخر</div></div>
  </div>

  <h2>تفاصيل الأعمال (${records.length})</h2>
  <table>
    <thead>
      <tr><th>المعلم</th><th>العنوان</th><th>النوع</th><th>الاستحقاق</th><th>الحالة</th></tr>
    </thead>
    <tbody>${recordsRows}</tbody>
  </table>

  ${substitutions.length > 0 ? `
  <h2>الإشغالات (${substitutions.length})</h2>
  <table>
    <thead><tr><th>التاريخ</th><th>الصف</th><th>المعلم الأصلي</th><th>البديل</th></tr></thead>
    <tbody>${subRows}</tbody>
  </table>
  ` : ""}

  ${departures.length > 0 ? `
  <h2>المغادرات (${departures.length})</h2>
  <table>
    <thead><tr><th>التاريخ</th><th>المعلم</th><th>المغادرة</th><th>العودة</th><th>النوع</th></tr></thead>
    <tbody>${depRows}</tbody>
  </table>
  ` : ""}

  <div class="footer">
    تم توليده في ${today} بواسطة ${escapeHtml(admin.name)} — نظام إدارة المدرسة
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("PDF/Print report failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
