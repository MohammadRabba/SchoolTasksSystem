"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  ChevronLeft,
  BellRing,
  AlertTriangle,
  RefreshCw,
  DoorOpen,
  Calendar as CalIcon,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  NORMAL: "bg-blue-500",
  LOW: "bg-gray-400",
};

export function CalendarView() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<any[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    void loadCalendar();
  }, [year, month]);

  useEffect(() => {
    void loadNotifications();
  }, []);

  async function loadCalendar() {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (res.ok) setData(await res.json());
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    try {
      const res = await fetch("/api/notifications?limit=10");
      const d = await res.json();
      setNotifs(d.notifications || []);
    } catch {
      setNotifs([]);
    }
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  // Build the calendar grid
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay(); // 0 = Sunday
  const totalCells = Math.ceil((startWeekday + lastDay) / 7) * 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  while (cells.length < totalCells) cells.push(null);

  const byDay: Record<number, any[]> = data?.byDay || {};
  const selectedEvents = selectedDay ? byDay[selectedDay] || [] : [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">التقويم الشهري والتنبيهات</h2>
        <p className="text-sm text-muted-foreground">
          نظرة شهرية على التكليفات والإشغالات والمغادرات + مركز التنبيهات
        </p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-lg font-bold min-w-44 text-center">
            {MONTHS[month]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            عاجل
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            عالية
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            عادية
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            منخفضة
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            إشغال
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            مغادرة
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-xs font-bold text-muted-foreground py-2">
                  {d}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={i} className="min-h-24" />;
                const events = byDay[day] || [];
                const isToday =
                  day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-24 p-1.5 border border-border rounded text-right hover:bg-muted/40 transition-colors",
                      isToday && "bg-primary/10 border-primary/30",
                      selectedDay === day && "ring-2 ring-primary"
                    )}
                  >
                    <div className={cn("text-sm mb-1", isToday && "font-bold text-primary")}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {/* Show up to 4 dots, then "+N" */}
                      {events.slice(0, 4).map((ev, idx) => {
                        const color = getEventColor(ev);
                        return (
                          <div
                            key={idx}
                            className={cn("w-1.5 h-1.5 rounded-full", color)}
                            title={ev.title}
                          />
                        );
                      })}
                      {events.length > 4 && (
                        <div className="text-[9px] text-muted-foreground">+{events.length - 4}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day events dialog */}
      <Dialog open={selectedDay !== null} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              أحداث يوم {selectedDay} {MONTHS[month]} {year}
            </DialogTitle>
          </DialogHeader>
          {selectedEvents.length === 0 ? (
            <EmptyState title="لا توجد أحداث في هذا اليوم" />
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((ev, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 p-3 border border-border rounded-md"
                >
                  <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", getEventBgColor(ev))}>
                    {ev.type === "assignment" ? (
                      <ClipboardList className="w-4 h-4 text-white" />
                    ) : ev.type === "substitution" ? (
                      <CalIcon className="w-4 h-4 text-white" />
                    ) : (
                      <DoorOpen className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ev.title}</p>
                    {ev.type === "assignment" && ev.workType && (
                      <p className="text-xs text-muted-foreground">
                        {ev.workType} — {ev.priority}
                      </p>
                    )}
                    {ev.type === "substitution" && (
                      <p className="text-xs text-muted-foreground">
                        حصة {ev.period} — البديل: {ev.substitute}
                      </p>
                    )}
                    {ev.type === "departure" && (
                      <p className="text-xs text-muted-foreground">
                        {ev.time} {ev.returnTime && `→ ${ev.returnTime}`} — {ev.approvalStatus}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Notifications section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            مركز التنبيهات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!notifs || notifs.length === 0 ? (
            <EmptyState
              title="لا توجد تنبيهات نشطة"
              description="جميع الأعمال ضمن الموعد، والإشغالات معينة، ولا توجد طلبات مغادرة معلقة"
              icon={<BellRing className="w-6 h-6" />}
            />
          ) : (
            <ul className="space-y-2">
              {notifs.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 p-3 border border-border rounded-md",
                    !n.isRead && "bg-accent/30"
                  )}
                >
                  <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1 num-ltr">
                      {new Date(n.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </div>
                  {!n.isRead && <Badge variant="default" className="shrink-0">جديد</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getEventColor(ev: any): string {
  if (ev.type === "assignment") return PRIORITY_COLORS[ev.priority] || "bg-blue-500";
  if (ev.type === "substitution") return ev.unassigned ? "bg-orange-500" : "bg-teal-500";
  if (ev.type === "departure") return "bg-indigo-500";
  return "bg-gray-400";
}

function getEventBgColor(ev: any): string {
  if (ev.type === "assignment") {
    if (ev.priority === "URGENT") return "bg-red-500";
    if (ev.priority === "HIGH") return "bg-orange-500";
    return "bg-blue-500";
  }
  if (ev.type === "substitution") return ev.unassigned ? "bg-orange-500" : "bg-teal-500";
  return "bg-indigo-500";
}
