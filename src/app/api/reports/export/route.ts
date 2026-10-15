import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "monthly";
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "start و end مطلوبان" }, { status: 400 });
    }

    const range = { start: new Date(start), end: new Date(end + "T23:59:59") };

    // Pull data
    const workRecords = await db.workRecord.findMany({
      where: {
        assignment: { dueDate: { gte: range.start, lte: range.end } },
        status: { not: "CANCELLED" },
      },
      include: {
        teacher: true,
        assignment: { include: { workType: true } },
      },
      take: 1000,
    });

    const substitutions = await db.substitution.findMany({
      where: { substitutionDate: { gte: range.start, lte: range.end } },
      include: { originalTeacher: true, substituteTeacher: true },
      take: 500,
    });

    const departures = await db.departure.findMany({
      where: { departureDate: { gte: range.start, lte: range.end } },
      include: { teacher: true },
      take: 500,
    });

    // Build workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "نظام إدارة المدرسة";
    wb.created = new Date();

    // Sheet 1: ملخص
    const summary = wb.addWorksheet("ملخص", {
      views: [{ rightToLeft: true }],
    });
    summary.columns = [
      { header: "المقياس", key: "metric", width: 35 },
      { header: "القيمة", key: "value", width: 20 },
    ];
    summary.getRow(1).font = { bold: true };
    const totalEligible = workRecords.length;
    const completed = workRecords.filter((r) => ["SUBMITTED", "COMPLETED", "APPROVED"].includes(r.status)).length;
    const approved = workRecords.filter((r) => r.status === "APPROVED").length;
    const overdue = workRecords.filter(
      (r) =>
        ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status) &&
        r.assignment.dueDate < new Date()
    ).length;

    summary.addRows([
      { metric: "اسم المدرسة", value: "مدرسة ذكور المستقبل الصالح الأساسية العليا" },
      { metric: "نوع التقرير", value: type === "monthly" ? "تقرير شهري" : type === "weekly" ? "تقرير أسبوعي" : "تقرير" },
      { metric: "من تاريخ", value: range.start.toLocaleDateString("ar-EG") },
      { metric: "إلى تاريخ", value: range.end.toLocaleDateString("ar-EG") },
      { metric: "تاريخ التوليد", value: new Date().toLocaleString("ar-EG") },
      { metric: "بواسطة", value: admin.name },
      { metric: "", value: "" },
      { metric: "إجمالي الأعمال المؤهلة", value: totalEligible },
      { metric: "أعمال مكتملة", value: completed },
      { metric: "أعمال معتمدة", value: approved },
      { metric: "أعمال متأخرة", value: overdue },
      { metric: "نسبة الإكمال (%)", value: totalEligible ? Math.round((completed / totalEligible) * 100) : 0 },
      { metric: "نسبة الاعتماد (%)", value: totalEligible ? Math.round((approved / totalEligible) * 100) : 0 },
      { metric: "نسبة التأخر (%)", value: totalEligible ? Math.round((overdue / totalEligible) * 100) : 0 },
      { metric: "إجمالي حصص الإشغال", value: substitutions.reduce((s, x) => s + x.numberOfPeriods, 0) },
      { metric: "إشغالات غير معينة", value: substitutions.filter((s) => !s.substituteTeacherId).length },
      { metric: "إجمالي المغادرات", value: departures.length },
      { metric: "مغادرات معتمدة", value: departures.filter((d) => d.approvalStatus === "APPROVED").length },
    ]);

    // Sheet 2: الأعمال
    const worksSheet = wb.addWorksheet("الأعمال", {
      views: [{ rightToLeft: true }],
    });
    worksSheet.columns = [
      { header: "المعلم", key: "teacher", width: 25 },
      { header: "نوع العمل", key: "workType", width: 25 },
      { header: "العنوان", key: "title", width: 35 },
      { header: "تاريخ التكليف", key: "assigned", width: 18 },
      { header: "تاريخ الاستحقاق", key: "due", width: 18 },
      { header: "تاريخ الإكمال", key: "completed", width: 18 },
      { header: "الحالة", key: "status", width: 18 },
      { header: "متأخر؟", key: "overdue", width: 12 },
    ];
    worksSheet.getRow(1).font = { bold: true };

    const STATUS_AR: Record<string, string> = {
      NOT_STARTED: "لم يبدأ",
      IN_PROGRESS: "قيد التنفيذ",
      SUBMITTED: "مُسلَّم",
      NEEDS_REVISION: "يحتاج تعديل",
      COMPLETED: "مكتمل",
      APPROVED: "معتمد",
      REJECTED: "مرفوض",
      CANCELLED: "ملغى",
    };

    for (const r of workRecords) {
      worksSheet.addRow({
        teacher: r.teacher.fullName,
        workType: r.assignment.workType?.name || "",
        title: r.assignment.title,
        assigned: r.assignment.assignedDate,
        due: r.assignment.dueDate,
        completed: r.completionDate,
        status: STATUS_AR[r.status] || r.status,
        overdue:
          ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"].includes(r.status) &&
          r.assignment.dueDate < new Date()
            ? "نعم"
            : "لا",
      });
    }
    worksSheet.getColumn("assigned").numFmt = "yyyy-mm-dd";
    worksSheet.getColumn("due").numFmt = "yyyy-mm-dd";
    worksSheet.getColumn("completed").numFmt = "yyyy-mm-dd";

    // Sheet 3: الإشغالات
    const subsSheet = wb.addWorksheet("الإشغالات", {
      views: [{ rightToLeft: true }],
    });
    subsSheet.columns = [
      { header: "التاريخ", key: "date", width: 18 },
      { header: "الحصة", key: "period", width: 10 },
      { header: "المعلم الأصلي", key: "original", width: 25 },
      { header: "المعلم البديل", key: "substitute", width: 25 },
      { header: "الصف", key: "class", width: 15 },
      { header: "الشعبة", key: "section", width: 12 },
      { header: "السبب", key: "reason", width: 20 },
      { header: "عدد الحصص", key: "periods", width: 12 },
    ];
    subsSheet.getRow(1).font = { bold: true };
    for (const s of substitutions) {
      subsSheet.addRow({
        date: s.substitutionDate,
        period: s.periodNumber,
        original: s.originalTeacher?.fullName || "—",
        substitute: s.substituteTeacher?.fullName || "غير معين",
        class: s.className,
        section: s.sectionName || "—",
        reason: s.reasonType,
        periods: s.numberOfPeriods,
      });
    }
    subsSheet.getColumn("date").numFmt = "yyyy-mm-dd";

    // Sheet 4: المغادرات
    const depsSheet = wb.addWorksheet("المغادرات", {
      views: [{ rightToLeft: true }],
    });
    depsSheet.columns = [
      { header: "التاريخ", key: "date", width: 18 },
      { header: "المعلم", key: "teacher", width: 25 },
      { header: "وقت المغادرة", key: "dep", width: 15 },
      { header: "وقت العودة", key: "ret", width: 15 },
      { header: "النوع", key: "type", width: 15 },
      { header: "حالة الموافقة", key: "approval", width: 18 },
      { header: "الحصص المتأثرة", key: "affected", width: 15 },
    ];
    depsSheet.getRow(1).font = { bold: true };
    for (const d of departures) {
      depsSheet.addRow({
        date: d.departureDate,
        teacher: d.teacher.fullName,
        dep: d.departureTime,
        ret: d.returnTime || "—",
        type: d.departureType,
        approval: d.approvalStatus,
        affected: d.affectedPeriodCount,
      });
    }
    depsSheet.getColumn("date").numFmt = "yyyy-mm-dd";

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="report-${type}-${start}-to-${end}.xlsx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
