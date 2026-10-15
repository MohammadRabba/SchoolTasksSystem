import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDashboardMetrics } from "@/lib/kpi";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const QuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  period: z.enum(["today", "week", "month", "term", "year", "custom"]).optional(),
});

export async function GET(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const parsed = QuerySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "بارامترات غير صالحة" }, { status: 400 });
    }

    let range: { start: Date; end: Date };

    if (parsed.data.start && parsed.data.end) {
      range = {
        start: new Date(parsed.data.start),
        end: new Date(parsed.data.end + "T23:59:59"),
      };
    } else {
      // Use period selector
      range = await resolveRange(parsed.data.period || "month");
    }

    const metrics = await getDashboardMetrics(range);

    // Also fetch recent activities
    const recentAudit = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { administrator: { select: { name: true } } },
    });

    const recent = recentAudit.map((a) => ({
      id: a.id,
      action: a.actionType,
      entityType: a.entityType,
      createdAt: a.createdAt,
      adminName: a.administrator?.name,
    }));

    return NextResponse.json({ metrics, range, recent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function resolveRange(period: string) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (period) {
    case "today":
      return { start: startOfDay, end: endOfDay };
    case "week": {
      const day = startOfDay.getDay();
      const start = new Date(startOfDay);
      start.setDate(startOfDay.getDate() - day);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "term": {
      const term = await db.schoolPeriod.findFirst({ where: { isActive: true } });
      if (term) return { start: term.startDate, end: term.endDate };
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
    }
    case "year": {
      const year = await db.schoolYear.findFirst({ where: { isActive: true } });
      if (year) return { start: year.startDate, end: year.endDate };
      const m = now.getMonth();
      const startYear = m >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      return { start: new Date(startYear, 8, 1), end: new Date(startYear + 1, 5, 30, 23, 59, 59) };
    }
    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59) };
  }
}
