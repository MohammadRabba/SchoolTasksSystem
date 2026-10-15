import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

/**
 * POST /api/backup/import
 * Body: backup JSON (as produced by /api/backup/export)
 * Mode: append (default) — adds new records; existing ones (matching by id) are skipped
 *
 * WARNING: This does NOT delete existing records. To do a true restore, the
 * admin should reset the database first (db:reset:safe) and then import.
 *
 * Note: SQLite doesn't support skipDuplicates in Prisma — we use createMany with
 * a manual pre-check for existing IDs (fetched in one query per table).
 */
export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body || !body.data || !body.version) {
      return NextResponse.json({ error: "ملف النسخة الاحتياطية غير صالح" }, { status: 400 });
    }
    const d = body.data;
    const stats: any = {};

    // Helper: filter out items whose IDs already exist in the DB (preserves full items)
    // Returns the SAME items (not stripped) so Prisma createMany accepts them with all fields.
    async function filterNew(items: any[], model: any): Promise<any[]> {
      if (!items?.length) return [];
      const ids = items.map((i) => i.id);
      const existing = await model.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((e: any) => e.id));
      return items.filter((i) => !existingIds.has(i.id));
    }

    if (d.settings?.length) {
      const newItems = await filterNew(d.settings, db.setting);
      if (newItems.length) await db.setting.createMany({ data: newItems });
      stats.settings = newItems.length;
    }
    if (d.schoolYears?.length) {
      const newItems = await filterNew(d.schoolYears, db.schoolYear);
      if (newItems.length) await db.schoolYear.createMany({ data: newItems });
      stats.schoolYears = newItems.length;
    }
    if (d.schoolPeriods?.length) {
      const newItems = await filterNew(d.schoolPeriods, db.schoolPeriod);
      if (newItems.length) await db.schoolPeriod.createMany({ data: newItems });
      stats.schoolPeriods = newItems.length;
    }
    if (d.classSections?.length) {
      const newItems = await filterNew(d.classSections, db.classSection);
      if (newItems.length) await db.classSection.createMany({ data: newItems });
      stats.classSections = newItems.length;
    }
    if (d.workTypes?.length) {
      const newItems = await filterNew(d.workTypes, db.workType);
      if (newItems.length) await db.workType.createMany({ data: newItems });
      stats.workTypes = newItems.length;
    }
    if (d.teachers?.length) {
      const newItems = await filterNew(d.teachers, db.teacher);
      if (newItems.length) await db.teacher.createMany({ data: newItems });
      stats.teachers = newItems.length;
    }
    if (d.teacherClassSections?.length) {
      const newItems = await filterNew(d.teacherClassSections, db.teacherClassSection);
      if (newItems.length) await db.teacherClassSection.createMany({ data: newItems });
      stats.teacherClassSections = newItems.length;
    }
    if (d.assignments?.length) {
      const cleaned = (await filterNew(d.assignments, db.assignment)).map((a: any) => ({
        id: a.id, title: a.title, description: a.description, workTypeId: a.workTypeId,
        assignedDate: new Date(a.assignedDate), dueDate: new Date(a.dueDate),
        schoolYearId: a.schoolYearId, schoolPeriodId: a.schoolPeriodId || null,
        coveredPeriodStart: a.coveredPeriodStart ? new Date(a.coveredPeriodStart) : null,
        coveredPeriodEnd: a.coveredPeriodEnd ? new Date(a.coveredPeriodEnd) : null,
        priority: a.priority, assignmentStatus: a.assignmentStatus,
        adminInstructions: a.adminInstructions, recurringAssignmentId: a.recurringAssignmentId || null,
        archivedAt: a.archivedAt ? new Date(a.archivedAt) : null,
        createdAt: new Date(a.createdAt), updatedAt: new Date(a.updatedAt),
      }));
      if (cleaned.length) await db.assignment.createMany({ data: cleaned });
      stats.assignments = cleaned.length;
    }
    if (d.workRecords?.length) {
      const newItems = await filterNew(d.workRecords, db.workRecord);
      const cleaned = newItems.map((r: any) => ({
        id: r.id, assignmentId: r.assignmentId, teacherId: r.teacherId, status: r.status,
        completionDate: r.completionDate ? new Date(r.completionDate) : null,
        submittedAt: r.submittedAt ? new Date(r.submittedAt) : null,
        approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
        approvedById: r.approvedById || null,
        administrativeNotes: r.administrativeNotes, revisionNotes: r.revisionNotes,
        createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
      }));
      if (cleaned.length) await db.workRecord.createMany({ data: cleaned });
      stats.workRecords = cleaned.length;
    }
    if (d.reviews?.length) {
      const newItems = await filterNew(d.reviews, db.review);
      if (newItems.length) await db.review.createMany({ data: newItems });
      stats.reviews = newItems.length;
    }
    if (d.substitutions?.length) {
      const newItems = (await filterNew(d.substitutions, db.substitution)).map((s: any) => ({
        ...s,
        substitutionDate: new Date(s.substitutionDate),
      }));
      if (newItems.length) await db.substitution.createMany({ data: newItems });
      stats.substitutions = newItems.length;
    }
    if (d.departures?.length) {
      const newItems = (await filterNew(d.departures, db.departure)).map((dp: any) => ({
        ...dp,
        departureDate: new Date(dp.departureDate),
      }));
      if (newItems.length) await db.departure.createMany({ data: newItems });
      stats.departures = newItems.length;
    }
    if (d.recurringAssignments?.length) {
      const newItems = (await filterNew(d.recurringAssignments, db.recurringAssignment)).map((r: any) => ({
        ...r,
        startDate: new Date(r.startDate),
        endDate: new Date(r.endDate),
        lastGeneratedAt: r.lastGeneratedAt ? new Date(r.lastGeneratedAt) : null,
      }));
      if (newItems.length) await db.recurringAssignment.createMany({ data: newItems });
      stats.recurringAssignments = newItems.length;
    }
    if (d.recurringAssignmentTeachers?.length) {
      const newItems = await filterNew(d.recurringAssignmentTeachers, db.recurringAssignmentTeacher);
      if (newItems.length) await db.recurringAssignmentTeacher.createMany({ data: newItems });
      stats.recurringAssignmentTeachers = newItems.length;
    }
    if (d.notifications?.length) {
      const newItems = (await filterNew(d.notifications, db.notification)).map((n: any) => ({
        ...n,
        createdAt: new Date(n.createdAt),
        resolvedAt: n.resolvedAt ? new Date(n.resolvedAt) : null,
      }));
      if (newItems.length) await db.notification.createMany({ data: newItems });
      stats.notifications = newItems.length;
    }

    await writeAuditLog({
      administratorId: admin.id,
      actionType: "IMPORT",
      entityType: "Backup",
      newValues: stats,
    });

    return NextResponse.json({
      imported: stats,
      totalRecords: Object.values(stats).reduce((s: number, v: any) => s + v, 0),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
