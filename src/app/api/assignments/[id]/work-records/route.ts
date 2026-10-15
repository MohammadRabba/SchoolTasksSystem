import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

interface Ctx { params: Promise<{ id: string }> }

// GET /api/assignments/[id]/work-records — list work records for an assignment
export async function GET(_req: Request, { params }: Ctx) {
  await requireAdmin();
  const { id } = await params;
  const items = await db.workRecord.findMany({
    where: { assignmentId: id },
    include: {
      teacher: { select: { id: true, fullName: true, employmentStatus: true } },
      reviews: { include: { administrator: { select: { name: true } } }, orderBy: { reviewedAt: 'desc' } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ items });
}
