"use client";

import { useAppStore, PeriodFilter } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { getPeriodLabel } from "@/lib/date-utils";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";

const PERIODS: PeriodFilter[] = ["today", "week", "month", "term", "year", "custom"];

export function PeriodFilterTabs() {
  const period = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const customStart = useAppStore((s) => s.customStart);
  const customEnd = useAppStore((s) => s.customEnd);
  const [showCustom, setShowCustom] = useState(period === "custom");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => {
              if (p === "custom") {
                setShowCustom(true);
                setPeriod(p);
              } else {
                setShowCustom(false);
                setPeriod(p);
              }
            }}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              period === p
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {getPeriodLabel(p)}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customStart || ""}
            onChange={(e) => setPeriod("custom", e.target.value, customEnd)}
            className="w-36"
          />
          <span className="text-muted-foreground text-sm">إلى</span>
          <Input
            type="date"
            value={customEnd || ""}
            onChange={(e) => setPeriod("custom", customStart, e.target.value)}
            className="w-36"
          />
        </div>
      )}
    </div>
  );
}

// Helper to compute date range from current period setting
export function usePeriodRange(): { start: Date; end: Date } {
  const period = useAppStore((s) => s.period);
  const customStart = useAppStore((s) => s.customStart);
  const customEnd = useAppStore((s) => s.customEnd);
  return computeRange(period, customStart, customEnd);
}

// Stable string key for the current period selection (use as a useEffect dep instead of Date objects)
export function usePeriodKey(): string {
  const period = useAppStore((s) => s.period);
  const customStart = useAppStore((s) => s.customStart);
  const customEnd = useAppStore((s) => s.customEnd);
  return `${period}|${customStart || ""}|${customEnd || ""}`;
}

export function computeRange(
  period: PeriodFilter,
  customStart?: string,
  customEnd?: string
): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (period) {
    case "today":
      return { start: startOfDay, end: endOfDay };
    case "week": {
      const day = startOfDay.getDay();
      const start = new Date(startOfDay);
      start.setDate(startOfDay.getDate() - day);
      const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "term": {
      // Default to current month; will be overridden on server with actual term
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    case "year": {
      // Default to current school year (Sep–Jun) — fallback to current year
      const m = now.getMonth();
      const startYear = m >= 8 ? now.getFullYear() : now.getFullYear() - 1;
      const start = new Date(startYear, 8, 1);
      const end = new Date(startYear + 1, 5, 30, 23, 59, 59);
      return { start, end };
    }
    case "custom": {
      if (customStart && customEnd) {
        return {
          start: new Date(customStart),
          end: new Date(customEnd + "T23:59:59"),
        };
      }
      return { start: startOfDay, end: endOfDay };
    }
  }
}
