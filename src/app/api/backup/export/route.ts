import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/backup/export
 * Returns the entire database (minus Admin.passwordHash and LoginAttempt) as JSON.
 * Used by the "Download backup" button in Settings.
 */
export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const [
      settings,
      schoolYears,
      schoolPeriods,
      teachers,
      teacherClassSections,
      classSections,
      workTypes,
      assignments,
      workRecords,
      reviews,
      substitutions,
      departures,
      auditLogs,
      recurringAssignments,
      recurringAssignmentTeachers,
      notifications,
    ] = await Promise.all([
      db.setting.findMany(),
      db.schoolYear.findMany(),
      db.schoolPeriod.findMany(),
      db.teacher.findMany(),
      db.teacherClassSection.findMany(),
      db.classSection.findMany(),
      db.workType.findMany(),
      db.assignment.findMany(),
      db.workRecord.findMany(),
      db.review.findMany(),
      db.substitution.findMany(),
      db.departure.findMany(),
      db.auditLog.findMany(),
      db.recurringAssignment.findMany(),
      db.recurringAssignmentTeacher.findMany(),
      db.notification.findMany(),
    ]);

    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      exportedBy: admin.email,
      data: {
        settings,
        schoolYears,
        schoolPeriods,
        teachers,
        teacherClassSections,
        classSections,
        workTypes,
        assignments,
        workRecords,
        reviews,
        substitutions,
        departures,
        auditLogs,
        recurringAssignments,
        recurringAssignmentTeachers,
        notifications,
      },
    };

    return NextResponse.json(backup, {
      headers: {
        "Content-Disposition": `attachment; filename="school-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
