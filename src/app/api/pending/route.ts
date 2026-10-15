import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const OVERDUE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"];

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Work records awaiting review (SUBMITTED) — for approval workflow
    const submittedRecords = await db.workRecord.findMany({
      where: { status: "SUBMITTED", assignment: { assignmentStatus: "ACTIVE" } },
      include: {
        teacher: { select: { id: true, fullName: true, specialization: true } },
        assignment: { select: { id: true, title: true, dueDate: true, workType: { select: { name: true } } } },
      },
      orderBy: { assignment: { dueDate: "asc" } },
      take: 100,
    });

    // 2. Departures awaiting approval (PENDING)
    const pendingDepartures = await db.departure.findMany({
      where: { approvalStatus: "PENDING" },
      include: { teacher: { select: { id: true, fullName: true } } },
      orderBy: { departureDate: "asc" },
      take: 100,
    });

    // 3. Unassigned substitutions (substituteTeacherId = null) — today + future
    const unassignedSubs = await db.substitution.findMany({
      where: {
        substituteTeacherId: null,
        substitutionDate: { gte: todayStart },
      },
      include: { originalTeacher: { select: { fullName: true } } },
      orderBy: { substitutionDate: "asc" },
      take: 100,
    });

    // 4. Overdue work records
    const overdueRecords = await db.workRecord.findMany({
      where: {
        status: { in: OVERDUE_STATUSES },
        assignment: {
          dueDate: { lt: now },
          assignmentStatus: "ACTIVE",
          archivedAt: null,
        },
      },
      include: {
        teacher: { select: { id: true, fullName: true, specialization: true } },
        assignment: {
          select: {
            id: true,
            title: true,
            dueDate: true,
            workType: { select: { name: true } },
            priority: true,
          },
        },
      },
      orderBy: { assignment: { dueDate: "asc" } },
      take: 100,
    });

    return NextResponse.json({
      counts: {
        submitted: submittedRecords.length,
        pendingDepartures: pendingDepartures.length,
        unassignedSubs: unassignedSubs.length,
        overdue: overdueRecords.length,
        total:
          submittedRecords.length +
          pendingDepartures.length +
          unassignedSubs.length +
          overdueRecords.length,
      },
      submittedRecords: submittedRecords.map((r) => ({
        id: r.id,
        teacherId: r.teacherId,
        teacherName: r.teacher.fullName,
        specialization: r.teacher.specialization,
        assignmentId: r.assignmentId,
        assignmentTitle: r.assignment.title,
        workType: r.assignment.workType?.name,
        dueDate: r.assignment.dueDate,
        status: r.status,
      })),
      pendingDepartures: pendingDepartures.map((d) => ({
        id: d.id,
        teacherName: d.teacher.fullName,
        departureDate: d.departureDate,
        departureTime: d.departureTime,
        returnTime: d.returnTime,
        departureType: d.departureType,
        reason: d.reason,
        affectedPeriodCount: d.affectedPeriodCount,
      })),
      unassignedSubs: unassignedSubs.map((s) => ({
        id: s.id,
        substitutionDate: s.substitutionDate,
        periodNumber: s.periodNumber,
        className: s.className,
        sectionName: s.sectionName,
        reasonType: s.reasonType,
        originalTeacher: s.originalTeacher?.fullName || null,
      })),
      overdueRecords: overdueRecords.map((r) => ({
        id: r.id,
        teacherId: r.teacherId,
        teacherName: r.teacher.fullName,
        specialization: r.teacher.specialization,
        assignmentId: r.assignmentId,
        assignmentTitle: r.assignment.title,
        workType: r.assignment.workType?.name,
        dueDate: r.assignment.dueDate,
        status: r.status,
        priority: r.assignment.priority,
        daysOverdue: Math.floor((now.getTime() - r.assignment.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
