import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

const AssignmentCreateSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional().nullable(),
  workTypeId: z.string().min(1, "نوع العمل مطلوب"),
  assignedDate: z.string(),
  dueDate: z.string(),
  schoolYearId: z.string().min(1, "العام الدراسي مطلوب"),
  schoolPeriodId: z.string().optional().nullable(),
  coveredPeriodStart: z.string().optional().nullable(),
  coveredPeriodEnd: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  adminInstructions: z.string().optional().nullable(),
  teacherIds: z.array(z.string()).min(1, "اختر معلمًا واحدًا على الأقل"),
});

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const workTypeId = url.searchParams.get("workTypeId") || "";
    const teacherId = url.searchParams.get("teacherId") || "";
    const schoolYearId = url.searchParams.get("schoolYearId") || "";
    const priority = url.searchParams.get("priority") || "";

    const where: any = {};
    if (status) where.assignmentStatus = status;
    if (workTypeId) where.workTypeId = workTypeId;
    if (schoolYearId) where.schoolYearId = schoolYearId;
    if (priority) where.priority = priority;
    if (teacherId) where.workRecords = { some: { teacherId } };
    if (search) where.title = { contains: search };

    const [total, assignments] = await Promise.all([
      db.assignment.count({ where }),
      db.assignment.findMany({
        where,
        include: {
          workType: true,
          schoolYear: true,
          schoolPeriod: true,
          workRecords: { include: { teacher: true } },
        },
        orderBy: { dueDate: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: assignments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
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
    const parsed = AssignmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Use transaction: create assignment + one work record per teacher
    const assignment = await db.$transaction(async (tx) => {
      const a = await tx.assignment.create({
        data: {
          title: d.title,
          description: d.description || null,
          workTypeId: d.workTypeId,
          assignedDate: new Date(d.assignedDate),
          dueDate: new Date(d.dueDate),
          schoolYearId: d.schoolYearId,
          schoolPeriodId: d.schoolPeriodId || null,
          coveredPeriodStart: d.coveredPeriodStart ? new Date(d.coveredPeriodStart) : null,
          coveredPeriodEnd: d.coveredPeriodEnd ? new Date(d.coveredPeriodEnd) : null,
          priority: d.priority,
          adminInstructions: d.adminInstructions || null,
        },
      });

      // Create one work record per teacher
      await tx.workRecord.createMany({
        data: d.teacherIds.map((teacherId) => ({
          assignmentId: a.id,
          teacherId,
          status: "NOT_STARTED",
        })),
      });

      return a;
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "Assignment",
      entityId: assignment.id,
      newValues: { title: assignment.title, teacherIds: d.teacherIds },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
    // Detect foreign-key violations and surface a clean message
    // (don't leak Prisma internals to the client in production)
    if (msg.includes("Foreign key constraint") || msg.includes("foreign key")) {
      return NextResponse.json(
        { error: "بيانات مرتبطة غير صالحة (نوع العمل، المعلم، أو العام الدراسي)" },
        { status: 400 }
      );
    }
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "تكرار في البيانات — يوجد سجل مماثل بالفعل" },
        { status: 409 }
      );
    }
    // In production, don't expose internal error messages
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "فشل إنشاء التكليف" }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
