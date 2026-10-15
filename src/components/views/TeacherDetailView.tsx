"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { EmploymentBadge, StatusBadge, PriorityBadge } from "@/components/common/StatusBadge";
import { useAppStore } from "@/store/useAppStore";
import { formatDate, formatNumber, formatPercent } from "@/lib/date-utils";
import {
  EMPLOYMENT_STATUS_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  SUBSTITUTION_REASON_LABELS,
  APPROVAL_STATUS_LABELS,
  DEPARTURE_TYPE_LABELS,
} from "@/lib/labels";
import {
  ArrowRight,
  Users,
  ClipboardList,
  CheckCircle2,
  ThumbsUp,
  AlertTriangle,
  RefreshCw,
  Calendar,
  DoorOpen,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const COLORS = ["#1e40af", "#0d9488", "#16a34a", "#f59e0b", "#dc2626", "#6b7280", "#7c3aed", "#ec4899"];

export function TeacherDetailView() {
  const teacherId = useAppStore((s) => s.selectedTeacherId);
  const setView = useAppStore((s) => s.setView);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId) {
      setView("teachers");
      return;
    }
    void load();
  }, [teacherId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/analytics`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل تحميل البيانات");
        setView("teachers");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!teacherId) return null;

  const t = data.teacher;
  const k = data.kpis;
  const s = data.substitutions;
  const d = data.departures;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setView("teachers")}>
          <ArrowRight className="w-4 h-4 ml-1" />
          العودة لقائمة المعلمين
        </Button>
      </div>

      {/* Teacher header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shrink-0">
              {t.fullName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{t.fullName}</h2>
              <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
                {t.specialization && <span>التخصص: {t.specialization}</span>}
                {t.subjects && <span>— المواد: {t.subjects}</span>}
                {t.employeeNumber && <span className="num-ltr">— ر.و: {t.employeeNumber}</span>}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <EmploymentBadge
                  status={t.employmentStatus}
                  label={EMPLOYMENT_STATUS_LABELS[t.employmentStatus]}
                />
                {t.specialization && (
                  <span className="text-xs px-2 py-1 bg-muted rounded">{t.specialization}</span>
                )}
                {t.weeklyPeriodCount > 0 && (
                  <span className="text-xs px-2 py-1 bg-muted rounded num-ltr">
                    {t.weeklyPeriodCount} حصة/أسبوع
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricCard label="إجمالي التكليفات" value={k.totalAssignments} icon={<ClipboardList className="w-4 h-4" />} />
        <MetricCard label="مكتملة" value={k.completed} icon={<CheckCircle2 className="w-4 h-4" />} color="text-teal-600" />
        <MetricCard label="معتمدة" value={k.approved} icon={<ThumbsUp className="w-4 h-4" />} color="text-green-600" />
        <MetricCard label="متأخرة" value={k.overdue} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-600" />
        <MetricCard label="تحتاج تعديل" value={k.needsRevision} icon={<RefreshCw className="w-4 h-4" />} color="text-orange-600" />
        <MetricCard label="إشغالات (بديل)" value={s.asSubstitute} icon={<Calendar className="w-4 h-4" />} color="text-cyan-600" />
        <MetricCard label="مغادرات" value={d.total} icon={<DoorOpen className="w-4 h-4" />} color="text-indigo-600" />
        <MetricCard label="معلقة" value={d.pending} icon={<Activity className="w-4 h-4" />} color="text-amber-600" />
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">نسبة الإكمال</p>
            <p className="text-2xl font-bold num-ltr">
              {k.completionRate !== null ? formatPercent(k.completionRate) : "لا توجد بيانات"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">نسبة الاعتماد</p>
            <p className="text-2xl font-bold num-ltr">
              {k.approvalRate !== null ? formatPercent(k.approvalRate) : "لا توجد بيانات"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">نسبة الإكمال في الوقت</p>
            <p className="text-2xl font-bold num-ltr">
              {k.onTimeRate !== null ? formatPercent(k.onTimeRate) : "لا توجد بيانات"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">متوسط زمن الإكمال</p>
            <p className="text-2xl font-bold num-ltr">
              {k.avgCompletionHours !== null ? `${k.avgCompletionHours.toFixed(1)} ساعة` : "لا توجد بيانات"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع حالة الأعمال</CardTitle>
          </CardHeader>
          <CardContent>
            {data.charts.statusDistribution?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.charts.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={(d: any) => `${d.name}: ${d.value}`}
                  >
                    {data.charts.statusDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد أعمال مسجلة" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">اتجاه الإنجاز الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            {data.charts.monthlyTrend?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.charts.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="الإجمالي" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="completed" name="المكتمل" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد بيانات كافية" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent assignments with drill-down */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">التكليفات الأخيرة ({data.recentRecords.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentRecords.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                  <TableHead>الإكمال</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الأولوية</TableHead>
                  <TableHead>تفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.title}
                      {r.recurringAssignmentId && (
                        <span className="text-[10px] text-muted-foreground mr-2 px-2 py-0.5 bg-accent/30 rounded">
                          تلقائي
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.workType}</TableCell>
                    <TableCell className="num-ltr text-sm">{formatDate(r.dueDate)}</TableCell>
                    <TableCell className="num-ltr text-sm">{formatDate(r.completionDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} label={STATUS_LABELS[r.status]} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={r.priority} label={PRIORITY_LABELS[r.priority]} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Navigate to assignments view (drill-down)
                          setView("assignments");
                        }}
                      >
                        عرض التكليف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد تكليفات مسجلة لهذا المعلم" />
          )}
        </CardContent>
      </Card>

      {/* Recent substitutions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الإشغالات ({data.recentSubstitutions.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentSubstitutions.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحصة</TableHead>
                  <TableHead>الصف</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>دور المعلم</TableHead>
                  <TableHead>عدد الحصص</TableHead>
                  <TableHead>تفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSubstitutions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="num-ltr text-sm">{formatDate(s.substitutionDate)}</TableCell>
                    <TableCell className="num-ltr">{s.periodNumber}</TableCell>
                    <TableCell>{s.className} {s.sectionName && `(${s.sectionName})`}</TableCell>
                    <TableCell className="text-xs">
                      {SUBSTITUTION_REASON_LABELS[s.reasonType] || s.reasonType}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        s.role === "original" ? "bg-blue-50 text-blue-700" : "bg-teal-50 text-teal-700"
                      }`}>
                        {s.role === "original" ? "المعلم الأصلي" : "المعلم البديل"}
                      </span>
                    </TableCell>
                    <TableCell className="num-ltr">{s.numberOfPeriods}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setView("substitutions")}
                      >
                        عرض الإشغالات
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد إشغالات مسجلة لهذا المعلم" />
          )}
        </CardContent>
      </Card>

      {/* Recent departures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">المغادرات ({data.recentDepartures.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentDepartures.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المغادرة</TableHead>
                  <TableHead>العودة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الحصص المتأثرة</TableHead>
                  <TableHead>تفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentDepartures.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="num-ltr text-sm">{formatDate(d.departureDate)}</TableCell>
                    <TableCell className="num-ltr">{d.departureTime}</TableCell>
                    <TableCell className="num-ltr">{d.returnTime || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {DEPARTURE_TYPE_LABELS[d.departureType] || d.departureType}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{APPROVAL_STATUS_LABELS[d.approvalStatus] || d.approvalStatus}</span>
                    </TableCell>
                    <TableCell className="num-ltr">{d.affectedPeriodCount}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setView("departures")}
                      >
                        عرض المغادرات
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد مغادرات مسجلة لهذا المعلم" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className={color || "text-muted-foreground"}>{icon}</span>
        </div>
        <p className="text-2xl font-bold num-ltr">{formatNumber(value)}</p>
      </CardContent>
    </Card>
  );
}
