import { db } from "@/lib/db";

export async function writeAuditLog(params: {
  administratorId: string;
  actionType: string; // CREATE, UPDATE, DELETE, ARCHIVE, APPROVE, REJECT, IMPORT, LOGIN, LOGOUT
  entityType: string;
  entityId?: string;
  previousValues?: unknown;
  newValues?: unknown;
}) {
  await db.auditLog.create({
    data: {
      administratorId: params.administratorId,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId || null,
      previousValues: params.previousValues
        ? JSON.stringify(params.previousValues)
        : null,
      newValues: params.newValues ? JSON.stringify(params.newValues) : null,
    },
  });
}

// Safe variant that doesn't throw — for use in auth flows where a failing audit log
// should NOT break the user's operation (e.g., recording LOGIN during authorize()).
export async function writeAuditLogSafe(params: {
  administratorId: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  previousValues?: unknown;
  newValues?: unknown;
}) {
  try {
    await writeAuditLog(params);
  } catch {
    // swallow — audit failure must not break login
  }
}
