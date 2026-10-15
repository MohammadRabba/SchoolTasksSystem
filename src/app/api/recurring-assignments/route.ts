import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { z } from "zod";

const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const RecurringAssignmentCreateSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().optional().nullable(),
  workTypeId: z.string().min(1, "نوع العمل مطلوب"),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
  daysOfWeek: z.string().min(1, "اختر يومًا واحدًا على الأقل"),
  startDate: z.string(),
  endDate: z.string(),
  dueOffsetDays: z.number().int().min(0).max(30).default(0),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  schoolYearId: z.string().min(1, "العام الدراسي مطلوب"),
  schoolPeriodId: z.string().optional().nullable(),
  adminInstructions: z.string().optional().nullable(),
  teacherIds: z.array(z.string()).min(1, "اختر معلمًا واحدًا على الأقل"),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const items = await db.recurringAssignment.findMany({
      include: {
        workType: true,
        schoolYear: true,
        schoolPeriod: true,
        teachers: { include: { teacher: { select: { id: true, fullName: true, specialization: true } } } },
        _count: { select: { assignments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(items);
  } catch (e) {
    return apiError(e, "فشل تحميل التكليفات التلقائية");
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
    const parsed = RecurringAssignmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Validate date order
    if (new Date(d.endDate) < new Date(d.startDate)) {
      return NextResponse.json(
        { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" },
        { status: 400 }
      );
    }

    // Validate daysOfWeek format based on frequency
    const days = d.daysOfWeek.split(",").map((x) => x.trim()).filter(Boolean);
    if (d.frequency === "DAILY" || d.frequency === "WEEKLY") {
      const invalid = days.filter((x) => !WEEKDAY_NAMES.includes(x));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `أيام غير صالحة: ${invalid.join(", ")} — استخدم: ${WEEKDAY_NAMES.join(", ")}` },
          { status: 400 }
        );
      }
    }
    if (d.frequency === "MONTHLY") {
      const invalid = days.filter((x) => {
        const n = Number(x);
        return isNaN(n) || n < 1 || n > 31;
      });
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "أيام الشهر يجب أن تكون أرقام بين 1 و 31" },
          { status: 400 }
        );
      }
    }

    // Create recurring assignment + teacher join rows in transaction
    const recurring = await db.$transaction(async (tx) => {
      const r = await tx.recurringAssignment.create({
        data: {
          title: d.title,
          description: d.description || null,
          workTypeId: d.workTypeId,
          frequency: d.frequency,
          daysOfWeek: d.daysOfWeek,
          startDate: new Date(d.startDate),
          endDate: new Date(d.endDate),
          dueOffsetDays: d.dueOffsetDays,
          priority: d.priority,
          schoolYearId: d.schoolYearId,
          schoolPeriodId: d.schoolPeriodId || null,
          adminInstructions: d.adminInstructions || null,
          isActive: true,
        },
      });
      await tx.recurringAssignmentTeacher.createMany({
        data: d.teacherIds.map((teacherId) => ({
          recurringAssignmentId: r.id,
          teacherId,
        })),
      });
      return r;
    });

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "CREATE",
      entityType: "RecurringAssignment",
      entityId: recurring.id,
      newValues: { title: recurring.title, frequency: recurring.frequency, teacherIds: d.teacherIds },
    });

    return NextResponse.json(recurring, { status: 201 });
  } catch (e) {
    return apiError(e, "فشل إنشاء التكليف التلقائي");
  }
}
