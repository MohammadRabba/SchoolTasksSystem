import { format, formatDistanceToNow, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  if (isNaN(date.getTime())) return "—";
  return format(date, "yyyy/MM/dd", { locale: arSA });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  if (isNaN(date.getTime())) return "—";
  return format(date, "yyyy/MM/dd HH:mm", { locale: arSA });
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return format(date, "HH:mm", { locale: arSA });
}

export function formatRelative(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  if (isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true, locale: arSA });
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("ar-EG").format(n);
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 }).format(n)}٪`;
}

export function formatDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

export function formatDateForDisplay(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? parseISO(d) : d;
  if (isNaN(date.getTime())) return "—";
  return format(date, "d MMMM yyyy", { locale: arSA });
}

// Get period display name
export function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    today: "اليوم",
    week: "الأسبوع الحالي",
    month: "الشهر الحالي",
    term: "الفصل الحالي",
    year: "العام الدراسي الحالي",
    custom: "نطاق مخصص",
  };
  return labels[period] || period;
}

// ============================================================
// Period resolver (used by /api/analytics and /api/reports/term)
// ============================================================

export type PeriodKind = "TODAY" | "WEEK" | "MONTH" | "TERM" | "YEAR" | "CUSTOM";

/**
 * Resolve a period kind to a date range.
 * - For TERM/YEAR, the caller may pass explicit term/year ISO strings.
 * - Falls back to current month if no school year/term is provided.
 */
export function resolvePeriod(
  opts: { kind: PeriodKind },
  explicit?: { termStart?: string; termEnd?: string; yearStart?: string; yearEnd?: string }
): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (opts.kind) {
    case "TODAY":
      return { start: startOfDay, end: endOfDay };
    case "WEEK": {
      const day = startOfDay.getDay();
      const start = new Date(startOfDay);
      start.setDate(startOfDay.getDate() - day);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    case "MONTH": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "TERM": {
      if (explicit?.termStart && explicit?.termEnd) {
        return { start: new Date(explicit.termStart), end: new Date(explicit.termEnd) };
      }
      // Fallback to current month if no active term
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "YEAR": {
      if (explicit?.yearStart && explicit?.yearEnd) {
        return { start: new Date(explicit.yearStart), end: new Date(explicit.yearEnd) };
      }
      // Default: Sep–Jun school year
      const m = now.getMonth();
      const startYear = m >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      return {
        start: new Date(startYear, 8, 1),
        end: new Date(startYear + 1, 5, 30, 23, 59, 59),
      };
    }
    case "CUSTOM":
    default:
      return { start: startOfDay, end: endOfDay };
  }
}
