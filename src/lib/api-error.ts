import { NextResponse } from "next/server";

/**
 * Convert a caught error into a clean Arabic JSON response.
 *
 * In development: returns the full error message for debugging.
 * In production: returns a generic Arabic message but maps known Prisma
 * constraint violations to specific Arabic user-facing messages.
 *
 * Usage:
 *   } catch (e) {
 *     return apiError(e, "فشل الحفظ");
 *   }
 */
export function apiError(e: unknown, fallbackMessage: string, status: number = 500): NextResponse {
  const msg = e instanceof Error ? e.message : String(e);

  // Foreign-key violations — show a specific message
  if (msg.includes("Foreign key constraint") || msg.includes("foreign key")) {
    return NextResponse.json(
      { error: "بيانات مرتبطة غير صالحة — تحقق من المعرفات المُدخلة" },
      { status: 400 }
    );
  }
  // Unique constraint violations
  if (msg.includes("Unique constraint")) {
    return NextResponse.json(
      { error: "تكرار في البيانات — يوجد سجل مماثل بالفعل" },
      { status: 409 }
    );
  }
  // Zod validation errors
  if (msg.includes("validation") || msg.includes("Invalid")) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  // In production, don't expose internal error messages
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: fallbackMessage }, { status });
  }
  return NextResponse.json({ error: msg }, { status });
}
