import { NextResponse } from 'next/server';
import { buildTeacherTemplate } from '@/lib/excel-import';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  const buf = await buildTeacherTemplate();
  // Convert Node Buffer to Uint8Array for NextResponse body
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="teacher-template.xlsx"',
    },
  });
}
