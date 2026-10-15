import { z } from "zod";

// ============================================================
// Validation schemas for school year settings
// ============================================================

// Base schema WITHOUT refinement — used for both create and update (partial)
export const schoolYearBaseSchema = z.object({
  name: z.string().min(2, "اسم العام الدراسي مطلوب").max(50),
  startDate: z.string().refine((v) => !isNaN(new Date(v).getTime()), {
    message: "تاريخ البداية غير صالح",
  }),
  endDate: z.string().refine((v) => !isNaN(new Date(v).getTime()), {
    message: "تاريخ النهاية غير صالح",
  }),
  isActive: z.boolean().default(false),
});

// Full create schema with date-ordering refinement
export const schoolYearCreateSchema = schoolYearBaseSchema.refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية", path: ["endDate"] }
);

// Partial update schema — built from base, no refinement (we re-check at the API layer)
export const schoolYearUpdateSchema = schoolYearBaseSchema.partial();

export type SchoolYearCreateInput = z.infer<typeof schoolYearCreateSchema>;
export type SchoolYearUpdateInput = z.infer<typeof schoolYearUpdateSchema>;
