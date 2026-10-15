import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
    const actionType = url.searchParams.get("actionType") || "";
    const entityType = url.searchParams.get("entityType") || "";
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");

    const where: any = {};
    if (actionType) where.actionType = actionType;
    if (entityType) where.entityType = entityType;
    if (start && end) {
      where.createdAt = { gte: new Date(start), lte: new Date(end + "T23:59:59") };
    }

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        include: { administrator: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: logs.map((l) => ({
        ...l,
        previousValues: l.previousValues ? JSON.parse(l.previousValues) : null,
        newValues: l.newValues ? JSON.parse(l.newValues) : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
