import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { schoolYearUpdateSchema } from '@/lib/validations/settings';
import { writeAuditLog } from '@/lib/audit';

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const parsed = schoolYearUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join('، ') }, { status: 400 });
  }
  const data = parsed.data;
  const existing = await db.schoolYear.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });

  // Re-check date ordering if either date is being updated
  const newStart = data.startDate ? new Date(data.startDate) : existing.startDate;
  const newEnd = data.endDate ? new Date(data.endDate) : existing.endDate;
  if (newEnd.getTime() < newStart.getTime()) {
    return NextResponse.json({ error: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية' }, { status: 400 });
  }

  const updated = await db.$transaction(async (tx) => {
    if (data.isActive) {
      await tx.schoolYear.updateMany({ where: { isActive: true, NOT: { id } }, data: { isActive: false } });
    }
    return tx.schoolYear.update({
      where: { id },
      data: {
        name: data.name,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        isActive: data.isActive,
      },
    });
  });
  await writeAuditLog({
    administratorId: admin.id,
    actionType: 'UPDATE',
    entityType: 'SCHOOL_YEAR',
    entityId: id,
    newValues: { name: updated.name, isActive: updated.isActive },
  });
  return NextResponse.json({ schoolYear: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const admin = await requireAdmin();
  const { id } = await params;
  const existing = await db.schoolYear.findUnique({ where: { id }, include: { _count: { select: { assignments: true, terms: true } } } });
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 });
  if (existing._count.assignments > 0) {
    return NextResponse.json(
      { error: 'لا يمكن حذف عام دراسي مرتبط بتكليفات. استخدم تعطيل بدلاً من الحذف.' },
      { status: 400 }
    );
  }
  await db.schoolYear.delete({ where: { id } });
  await writeAuditLog({
    administratorId: admin.id,
    actionType: 'DELETE',
    entityType: 'SCHOOL_YEAR',
    entityId: id,
  });
  return NextResponse.json({ deleted: true });
}
