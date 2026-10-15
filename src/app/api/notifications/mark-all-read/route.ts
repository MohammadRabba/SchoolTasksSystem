import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Mark all unresolved notifications as read
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  try {
    const result = await db.notification.updateMany({
      where: { isRead: false, isResolved: false },
      data: { isRead: true },
    });
    return NextResponse.json({ updated: result.count });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
