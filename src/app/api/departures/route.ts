import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const DepartureSchema = z.object({
  teacherId: z.string().min(1, "المعلم مطلوب"),
  departureDate: z.string(),
  departureTime: z.string().min(1, "وقت المغادرة مطلوب"),
  returnTime: z.string().optional().nullable(),
  departureType: z.enum(["PERSONAL", "MEDICAL", "OFFICIAL", "EMERGENCY", "OTHER"]),
  reason: z.string().optional().nullable(),
  permissionType: z.enum(["PRE_APPROVED", "EMERGENCY"]).default("PRE_APPROVED"),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED", "COMPLETED"]).default("PENDING"),
  authorizedBy: z.string().optional().nullable(),
  affectedPeriodCount: z.number().int().min(0).default(0),
  coverageArrangements: z.string().optional().nullable(),
  administrativeNotes: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const teacherId = url.searchParams.get("teacherId");
    const status = url.searchParams.get("status");

    const where: any = {};
    if (start && end) {
      where.departureDate = { gte: new Date(start), lte: new Date(end + "T23:59:59") };
    }
    if (teacherId) where.teacherId = teacherId;
    if (status) where.approvalStatus = status;

    const deps = await db.departure.findMany({
      where,
      include: { teacher: true },
      orderBy: { departureDate: "desc" },
      take: 200,
    });
    return NextResponse.json(deps);
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = DepartureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const d = parsed.data;
    const dep = await db.departure.create({
      data: {
        teacherId: d.teacherId,
        departureDate: new Date(d.departureDate),
        departureTime: d.departureTime,
        returnTime: d.returnTime || null,
        departureType: d.departureType,
        reason: d.reason || null,
        permissionType: d.permissionType,
        approvalStatus: d.approvalStatus,
        authorizedBy: d.authorizedBy || null,
        affectedPeriodCount: d.affectedPeriodCount,
        coverageArrangements: d.coverageArrangements || null,
        administrativeNotes: d.administrativeNotes || null,
      },
      include: { teacher: true },
    });
    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "Departure",
      entityId: dep.id,
      newValues: d,
    });
    return NextResponse.json(dep, { status: 201 });
  } catch (e) {
    return apiError(e, "فشلت العملية");
  }
}
