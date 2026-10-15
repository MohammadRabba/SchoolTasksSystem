"use client";

import { useAppStore } from "@/store/useAppStore";
import { NAV_ITEMS } from "@/lib/labels";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  ClipboardList,
  Calendar,
  DoorOpen,
  BellRing,
  FileText,
  BarChart3,
  History,
  Settings,
  GraduationCap,
  Repeat,
  AlertCircle,
  School,
  DatabaseBackup,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  LayoutDashboard,
  Users,
  ListChecks,
  ClipboardList,
  Calendar,
  DoorOpen,
  BellRing,
  FileText,
  BarChart3,
  History,
  Settings,
  Repeat,
  AlertCircle,
  School,
  DatabaseBackup,
} as const;

export function Sidebar() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);

  return (
    <aside className="w-64 h-screen sticky top-0 bg-sidebar border-l border-sidebar-border flex flex-col">
      {/* Logo + school name */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground leading-tight">
              مدرسة ذكور المستقبل
            </p>
            <p className="text-xs text-muted-foreground leading-tight">
              الصالح الأساسية العليا
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS];
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground">
        نظام إدارة المدرسة — الإصدار 1.0
      </div>
    </aside>
  );
}
