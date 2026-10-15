import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getWorkStatusDistribution,
  getSubstitutionByTeacher,
  getOverdueByCategory,
  getMonthlyCompletionTrend,
  getRequiredVsCompleted,
} from "@/lib/kpi";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start و end مطلوبان" },
        { status: 400 }
      );
    }

    const range = { start: new Date(start), end: new Date(end) };

    const [statusDistribution, subsByTeacher, overdueByCategory, monthlyTrend, requiredVsCompleted] =
      await Promise.all([
        getWorkStatusDistribution(range),
        getSubstitutionByTeacher(range),
        getOverdueByCategory(range),
        getMonthlyCompletionTrend(range),
        getRequiredVsCompleted(range),
      ]);

    return NextResponse.json({
      statusDistribution,
      subsByTeacher,
      overdueByCategory,
      monthlyTrend,
      requiredVsCompleted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
