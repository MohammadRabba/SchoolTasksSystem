import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/**
 * GET /api/notifications
 *   ?count=true  → returns just the unread count (lightweight, used by header bell)
 *   (default)    → returns full list (used by notification center dropdown)
 */

const OVERDUE_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "NEEDS_REVISION"];

// Compute notification "candidates" from real DB state. We materialize them into
// the Notification table so they persist + can be marked as read/resolved.
async function materializeNotifications() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days

  // 1. Overdue work
  const overdueCount = await db.workRecord.count({
    where: {
      status: { in: OVERDUE_STATUSES },
      assignment: { dueDate: { lt: now }, assignmentStatus: "ACTIVE", archivedAt: null },
    },
  });
  if (overdueCount > 0) {
    await upsertNotification({
      type: "OVERDUE",
      title: "أعمال متأخرة",
      message: `يوجد ${overdueCount} عمل متأخر عن موعده`,
      entityType: "WorkRecord",
      entityId: null,
    });
  } else {
    await resolveNotification("OVERDUE");
  }

  // 2. Unassigned substitutions
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const unassigned = await db.substitution.count({
    where: { substitutionDate: { gte: today }, substituteTeacherId: null },
  });
  if (unassigned > 0) {
    await upsertNotification({
      type: "UNASSIGNED_SUBSTITUTION",
      title: "إشغالات غير معينة",
      message: `يوجد ${unassigned} حصة إشغال بدون معلم بديل`,
      entityType: "Substitution",
      entityId: null,
    });
  } else {
    await resolveNotification("UNASSIGNED_SUBSTITUTION");
  }

  // 3. Pending departures
  const pendingDeps = await db.departure.count({ where: { approvalStatus: "PENDING" } });
  if (pendingDeps > 0) {
    await upsertNotification({
      type: "DEPARTURE_PENDING",
      title: "مغادرات بانتظار الموافقة",
      message: `${pendingDeps} طلب مغادرة بانتظار الموافقة`,
      entityType: "Departure",
      entityId: null,
    });
  } else {
    await resolveNotification("DEPARTURE_PENDING");
  }

  // 4. Needs revision
  const needsRevision = await db.workRecord.count({ where: { status: "NEEDS_REVISION" } });
  if (needsRevision > 0) {
    await upsertNotification({
      type: "REVISION_REQUESTED",
      title: "أعمال تحتاج تعديل",
      message: `${needsRevision} عمل بانتظار التعديل`,
      entityType: "WorkRecord",
      entityId: null,
    });
  } else {
    await resolveNotification("REVISION_REQUESTED");
  }

  // Cleanup old resolved notifications (>30 days)
  await db.notification.deleteMany({
    where: { isResolved: true, resolvedAt: { lt: since } },
  });
}

async function upsertNotification(params: {
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string | null;
}) {
  // Check if an unresolved notification of this type already exists
  const existing = await db.notification.findFirst({
    where: { type: params.type, isResolved: false },
  });
  if (existing) {
    // Update message (count may have changed)
    if (existing.message !== params.message) {
      await db.notification.update({
        where: { id: existing.id },
        data: { message: params.message },
      });
    }
    return;
  }
  // Otherwise create a new one
  await db.notification.create({ data: params });
}

async function resolveNotification(type: string) {
  await db.notification.updateMany({
    where: { type, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date() },
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  try {
    // Materialize current state into persistent notifications
    await materializeNotifications();

    const url = new URL(req.url);
    const onlyCount = url.searchParams.get("count") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "20");

    if (onlyCount) {
      const unread = await db.notification.count({
        where: { isRead: false, isResolved: false },
      });
      return NextResponse.json({ unread });
    }

    const notifications = await db.notification.findMany({
      where: { isResolved: false },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      unread: notifications.filter((n) => !n.isRead).length,
      notifications,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
