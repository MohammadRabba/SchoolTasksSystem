import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { apiError } from "@/lib/api-error";

const TeacherCreateSchema = z.object({
  employeeNumber: z.string().optional().nullable(),
  fullName: z.string().min(2, "الاسم مطلوب"),
  specialization: z.string().optional().nullable(),
  subjects: z.string().optional().nullable(),
  weeklyPeriodCount: z.number().int().min(0).default(0),
  employmentStartDate: z.string().optional().nullable(),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "INACTIVE"]).default("ACTIVE"),
  administrativeNotes: z.string().optional().nullable(),
  classesAndSections: z.array(z.object({ className: z.string(), sectionName: z.string().optional().nullable() })).optional(),
});

export async function GET(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const sortBy = url.searchParams.get("sortBy") || "fullName";
    const sortOrder = url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    const where: any = {};
    if (!includeArchived) where.archivedAt = null;
    if (status) where.employmentStatus = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { employeeNumber: { contains: search } },
        { specialization: { contains: search } },
        { subjects: { contains: search } },
      ];
    }

    const [total, teachers] = await Promise.all([
      db.teacher.count({ where }),
      db.teacher.findMany({
        where,
        include: { classesAndSections: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: teachers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
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
    const parsed = TeacherCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    if (d.employeeNumber) {
      const existing = await db.teacher.findUnique({ where: { employeeNumber: d.employeeNumber } });
      if (existing) {
        return NextResponse.json(
          { error: "الرقم الوظيفي مستخدم بالفعل" },
          { status: 400 }
        );
      }
    }

    const teacher = await db.teacher.create({
      data: {
        employeeNumber: d.employeeNumber || null,
        fullName: d.fullName,
        specialization: d.specialization || null,
        subjects: d.subjects || null,
        weeklyPeriodCount: d.weeklyPeriodCount,
        employmentStartDate: d.employmentStartDate ? new Date(d.employmentStartDate) : null,
        employmentStatus: d.employmentStatus,
        administrativeNotes: d.administrativeNotes || null,
        classesAndSections: d.classesAndSections?.length
          ? { create: d.classesAndSections.map((c) => ({ className: c.className, sectionName: c.sectionName || null })) }
          : undefined,
      },
      include: { classesAndSections: true },
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "Teacher",
      entityId: teacher.id,
      newValues: { fullName: teacher.fullName, employeeNumber: teacher.employeeNumber },
    });

    return NextResponse.json(teacher, { status: 201 });
  } catch (e) {
    return apiError(e, "فشل إنشاء المعلم");
  }
}
