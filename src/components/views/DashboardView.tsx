"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodFilterTabs, usePeriodRange, usePeriodKey } from "@/components/common/PeriodFilter";
import { EmptyState } from "@/components/common/EmptyState";
import { useAppStore } from "@/store/useAppStore";
import {
  Users,
  ClipboardList,
  CheckCircle2,
  ThumbsUp,
  Clock,
  AlertTriangle,
  RefreshCw,
  Calendar,
  DoorOpen,
  Settings2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/date-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Metrics {
  activeTeachers: number;
  assignmentsDue: number;
  workInProgress: number;
  workSubmittedOrCompleted: number;
  workApproved: number;
  workOverdue: number;
  workNeedsRevision: number;
  totalSubstitutionPeriods: number;
  unassignedSubstitutions: number;
  totalDepartures: number;
  pendingDepartureApprovals: number;
}

const COLORS = ["#1e40af", "#0d9488", "#16a34a", "#f59e0b", "#dc2626", "#6b7280", "#7c3aed", "#ec4899"];

export function DashboardView() {
  const period = useAppStore((s) => s.period);
  const range = usePeriodRange();
  const rangeKey = usePeriodKey();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<any[]>([]);
  const autoRanRef = useRef(false);

  useEffect(() => {
    // Fire-and-forget: trigger recurring assignment auto-generation once per page session
    // (silent — doesn't show toast unless run from the recurring-assignments page)
    if (!autoRanRef.current) {
      autoRanRef.current = true;
      fetch("/api/recurring-assignments/run", { method: "POST" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.created > 0) {
            // Refresh the dashboard to pick up the new assignments
            void loadAll();
          }
        })
        .catch(() => {});
    }
    void loadAll();
  }, [rangeKey]);

  async function loadAll() {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch(
          `/api/dashboard?start=${range.start.toISOString().split("T")[0]}&end=${range.end.toISOString().split("T")[0]}`
        ),
        fetch(
          `/api/dashboard/charts?start=${range.start.toISOString().split("T")[0]}&end=${range.end.toISOString().split("T")[0]}`
        ),
      ]);

      if (mRes.ok) {
        const d = await mRes.json();
        setMetrics(d.metrics);
        setRecent(d.recent || []);
      } else {
        toast.error("فشل تحميل البيانات");
      }
      if (cRes.ok) setCharts(await cRes.json());
    } catch (e) {
      toast.error("حدث خطأ أثناء التحميل");
    } finally {
      setLoading(false);
    }
  }

  if (loading || !metrics) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[...Array(11)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const cards: { label: string; value: number; icon: React.ReactNode; color: string; key?: string }[] = [
    { label: "المعلمون النشطون", value: metrics.activeTeachers, icon: <Users className="w-4 h-4" />, color: "text-blue-600" },
    { label: "التكليفات المستحقة", value: metrics.assignmentsDue, icon: <ClipboardList className="w-4 h-4" />, color: "text-purple-600" },
    { label: "أعمال قيد التنفيذ", value: metrics.workInProgress, icon: <Clock className="w-4 h-4" />, color: "text-blue-600" },
    { label: "أعمال مكتملة/مسلمة", value: metrics.workSubmittedOrCompleted, icon: <CheckCircle2 className="w-4 h-4" />, color: "text-teal-600" },
    { label: "أعمال معتمدة", value: metrics.workApproved, icon: <ThumbsUp className="w-4 h-4" />, color: "text-green-600" },
    { label: "أعمال متأخرة", value: metrics.workOverdue, icon: <AlertTriangle className="w-4 h-4" />, color: "text-red-600" },
    { label: "تحتاج تعديل", value: metrics.workNeedsRevision, icon: <RefreshCw className="w-4 h-4" />, color: "text-orange-600" },
    { label: "إجمالي حصص الإشغال", value: metrics.totalSubstitutionPeriods, icon: <Calendar className="w-4 h-4" />, color: "text-cyan-600" },
    { label: "إشغالات غير معينة", value: metrics.unassignedSubstitutions, icon: <AlertTriangle className="w-4 h-4" />, color: "text-amber-600" },
    { label: "تقارير المغادرة", value: metrics.totalDepartures, icon: <DoorOpen className="w-4 h-4" />, color: "text-indigo-600" },
    { label: "موافقات مغادرة معلقة", value: metrics.pendingDepartureApprovals, icon: <Settings2 className="w-4 h-4" />, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">لوحة التحكم</h2>
          <p className="text-sm text-muted-foreground">
            نظرة عامة على أداء المدرسة في الفترة المحددة
          </p>
        </div>
        <PeriodFilterTabs />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {c.label}
                </span>
                <span className={c.color}>{c.icon}</span>
              </div>
              <p className="text-2xl font-bold num-ltr">{formatNumber(c.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع حالة الأعمال</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.statusDistribution?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={charts.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    label={(d: any) => `${d.name}: ${d.value}`}
                  >
                    {charts.statusDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد بيانات كافية" description="لا توجد أعمال كتابية في هذه الفترة" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">المطلوب مقابل المكتمل والمعتمد والمتأخر</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.requiredVsCompleted?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={charts.requiredVsCompleted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="العدد" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد بيانات كافية" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الإشغالات حسب المعلم البديل</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.subsByTeacher?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={charts.subsByTeacher.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="periods" name="عدد الحصص" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد إشغالات مسجلة في هذه الفترة" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الأعمال المتأخرة حسب النوع</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.overdueByCategory?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={charts.overdueByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="العدد" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد أعمال متأخرة" description="جميع الأعمال مكتملة أو ضمن الموعد المحدد" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">اتجاه الإنجاز الشهري</CardTitle>
        </CardHeader>
        <CardContent>
          {charts?.monthlyTrend?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={charts.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="الإجمالي" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="completed" name="المكتمل" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="لا توجد بيانات كافية لعرض الاتجاه" />
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">آخر العمليات</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length ? (
            <ul className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-1 rounded bg-muted">
                      {r.action}
                    </span>
                    <span className="text-sm">{r.entityType}</span>
                  </div>
                  <span className="text-xs text-muted-foreground num-ltr">
                    {new Date(r.createdAt).toLocaleString("ar-EG")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد عمليات بعد" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
