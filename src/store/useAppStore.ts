"use client";

import { create } from "zustand";

export type AppView =
  | "dashboard"
  | "teachers"
  | "teacher-detail"
  | "work-types"
  | "assignments"
  | "recurring-assignments"
  | "substitutions"
  | "departures"
  | "pending"
  | "calendar"
  | "reports"
  | "analytics"
  | "audit"
  | "settings"
  | "class-sections"
  | "backup-restore";

export type PeriodFilter =
  | "today"
  | "week"
  | "month"
  | "term"
  | "year"
  | "custom";

interface AppState {
  // Navigation
  view: AppView;
  setView: (v: AppView) => void;

  // Period filter (used by dashboard + reports + analytics)
  period: PeriodFilter;
  customStart?: string;
  customEnd?: string;
  setPeriod: (p: PeriodFilter, start?: string, end?: string) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Notification refresh trigger (incremented after mutations to refetch counts)
  notificationTrigger: number;
  bumpNotifications: () => void;

  // Selected teacher (for drilldown)
  selectedTeacherId?: string;
  setSelectedTeacherId: (id?: string) => void;

  // Selected assignment filter (for dashboard drilldown)
  drilldownFilter?: { type: string; value: string };
  setDrilldownFilter: (f?: { type: string; value: string }) => void;
}

function readHashView(): AppView {
  if (typeof window === "undefined") return "dashboard";
  const h = window.location.hash.replace(/^#/, "") as AppView;
  const valid: AppView[] = [
    "dashboard",
    "teachers",
    "teacher-detail",
    "work-types",
    "assignments",
    "recurring-assignments",
    "substitutions",
    "departures",
    "pending",
    "calendar",
    "reports",
    "analytics",
    "audit",
    "settings",
    "class-sections",
    "backup-restore",
  ];
  return valid.includes(h) ? h : "dashboard";
}

export const useAppStore = create<AppState>((set) => ({
  view: typeof window !== "undefined" ? readHashView() : "dashboard",
  setView: (v) => {
    if (typeof window !== "undefined") {
      window.location.hash = v;
    }
    set({ view: v });
  },
  period: "month",
  setPeriod: (p, start, end) =>
    set({ period: p, customStart: start, customEnd: end }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  notificationTrigger: 0,
  bumpNotifications: () =>
    set((s) => ({ notificationTrigger: s.notificationTrigger + 1 })),
  setSelectedTeacherId: (id) => set({ selectedTeacherId: id }),
  setDrilldownFilter: (f) => set({ drilldownFilter: f }),
}));

if (typeof window !== "undefined") {
  // Sync store with URL hash on back/forward
  window.addEventListener("hashchange", () => {
    const v = readHashView();
    useAppStore.setState({ view: v });
  });
}
