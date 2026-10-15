import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { parseTeacherImport } from '@/lib/excel-import';
import { writeAuditLog } from '@/lib/audit';

interface ImportRowInput {
  employeeNumber?: string;
  fullName: string;
  specialization?: string;
  subjects?: string;
  weeklyPeriodCount?: number;
  employmentStartDate?: string;
  employmentStatus?: string;
  administrativeNotes?: string;
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const formData = await req.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400 });
  }
  const buffer = await file.arrayBuffer();
  const { rows } = await parseTeacherImport(buffer);
  const valid = rows.filter((r) => r.valid);

  // Detect duplicate employee numbers within DB and within batch
  const existingEmpNums = new Set<string>();
  const existing = await db.teacher.findMany({
    where: { employeeNumber: { not: null } },
    select: { employeeNumber: true },
  });
  existing.forEach((t) => {
    if (t.employeeNumber) existingEmpNums.add(t.employeeNumber);
  });

  const seen = new Set<string>();
  const toCreate: ImportRowInput[] = [];
  const skipped: { row: number; reason: string }[] = [];

  for (const r of valid) {
    if (r.employeeNumber) {
      if (existingEmpNums.has(r.employeeNumber)) {
        skipped.push({ row: r.rowIndex, reason: 'الرقم الوظيفي مستخدم مسبقاً' });
        continue;
      }
      if (seen.has(r.employeeNumber)) {
        skipped.push({ row: r.rowIndex, reason: 'تكرار داخل الملف' });
        continue;
      }
      seen.add(r.employeeNumber);
    }
    if (!r.fullName) {
      skipped.push({ row: r.rowIndex, reason: 'الاسم ناقص' });
      continue;
    }
    toCreate.push({
      employeeNumber: r.employeeNumber || undefined,
      fullName: r.fullName,
      specialization: r.specialization,
      subjects: r.subjects,
      weeklyPeriodCount: r.weeklyPeriodCount,
      employmentStartDate: r.employmentStartDate,
      employmentStatus: r.employmentStatus,
      administrativeNotes: r.administrativeNotes,
    });
  }

  const created = await db.$transaction(async (tx) => {
    let n = 0;
    for (const row of toCreate) {
      try {
        await tx.teacher.create({
          data: {
            employeeNumber: row.employeeNumber || null,
            fullName: row.fullName,
            specialization: row.specialization || null,
            subjects: row.subjects || null,
            weeklyPeriodCount: row.weeklyPeriodCount ?? 0,
            employmentStartDate: row.employmentStartDate ? new Date(row.employmentStartDate) : null,
            employmentStatus: (row.employmentStatus as 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE') || 'ACTIVE',
            administrativeNotes: row.administrativeNotes || null,
          },
        });
        n++;
      } catch (e) {
        skipped.push({
          row: 0,
          reason: e instanceof Error ? e.message : 'خطأ في الإنشاء',
        });
      }
    }
    return n;
  });

  await writeAuditLog({
    administratorId: admin.id,
    actionType: 'IMPORT',
    entityType: 'TEACHER',
    newValues: { created, skipped: skipped.length, attempted: valid.length },
  });

  return NextResponse.json({
    created,
    skippedCount: skipped.length,
    skipped,
    totalRows: rows.length,
    invalidRows: rows.filter((r) => !r.valid).length,
    invalidErrors: rows.filter((r) => !r.valid).map((r) => ({ row: r.rowIndex, errors: r.errors })),
  });
}
