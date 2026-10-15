"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { PeriodFilterTabs, usePeriodRange, usePeriodKey } from "@/components/common/PeriodFilter";
import { formatPercent, formatDate, formatNumber } from "@/lib/date-utils";
import {
  STATUS_LABELS,
  SUBSTITUTION_REASON_LABELS,
  APPROVAL_STATUS_LABELS,
  DEPARTURE_TYPE_LABELS,
} from "@/lib/labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Download, FileText, Printer } from "lucide-react";

export function ReportsView() {
  const range = usePeriodRange();
  const rangeKey = usePeriodKey();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [rangeKey]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString().split("T")[0],
        end: range.end.toISOString().split("T")[0],
      });
      const res = await fetch(`/api/reports/monthly?${params}`);
      const data = await res.json();
      if (res.ok) setReport(data);
      else toast.error(data.error || "فشل التحميل");
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const params = new URLSearchParams({
      type: "monthly",
      start: range.start.toISOString().split("T")[0],
      end: range.end.toISOString().split("T")[0],
    });
    const res = await fetch(`/api/reports/export?${params}`);
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${params.get("start")}-to-${params.get("end")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تصدير التقرير");
    } else {
      toast.error("فشل التصدير");
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const k = report?.kpis;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-print">
        <div>
          <h2 className="text-2xl font-bold">التقارير</h2>
          <p className="text-sm text-muted-foreground">
            تقرير شامل للفترة: {formatDate(range.start)} — {formatDate(range.end)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 ml-2" />
            تصدير Excel
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 ml-2" />
            طباعة / PDF
          </Button>
        </div>
      </div>

      <div className="no-print">
        <PeriodFilterTabs />
      </div>

      {/* Print header — visible only when printing */}
      <div className="print-only hidden mb-6">
        <h1 className="text-2xl font-bold text-center">
          مدرسة ذكور المستقبل الصالح الأساسية العليا
        </h1>
        <p className="text-center">تقرير الأداء للفترة: {formatDate(range.start)} — {formatDate(range.end)}</p>
        <p className="text-center text-sm">تاريخ التوليد: {formatDate(new Date())}</p>
      </div>

      {/* KPIs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">مؤشرات الأداء</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiBox label="إجمالي الأعمال" value={k?.totalEligible} />
            <KpiBox label="أعمال مكتملة" value={k?.completed} />
            <KpiBox label="أعمال معتمدة" value={k?.approved} />
            <KpiBox label="أعمال متأخرة" value={k?.overdue} highlight={k?.overdue > 0 ? "red" : undefined} />
            <KpiBox label="قيد التنفيذ" value={k?.inProgress} />
            <KpiBox label="تحتاج تعديل" value={k?.needsRevision} />
            <KpiBox
              label="نسبة الإكمال"
              value={k?.completionRate !== null ? `${k?.completionRate?.toFixed(1)}%` : "لا توجد بيانات"}
            />
            <KpiBox
              label="نسبة الاعتماد"
              value={k?.approvalRate !== null ? `${k?.approvalRate?.toFixed(1)}%` : "لا توجد بيانات"}
            />
            <KpiBox
              label="نسبة الإكمال في الوقت"
              value={k?.onTimeCompletionRate !== null ? `${k?.onTimeCompletionRate?.toFixed(1)}%` : "—"}
            />
            <KpiBox
              label="نسبة التأخر"
              value={k?.overdueRate !== null ? `${k?.overdueRate?.toFixed(1)}%` : "—"}
              highlight={k?.overdueRate > 30 ? "red" : undefined}
            />
            <KpiBox
              label="متوسط زمن الإكمال"
              value={k?.avgCompletionHours !== null ? `${(k?.avgCompletionHours || 0).toFixed(1)} ساعة` : "—"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Most delayed work types */}
      {report?.mostDelayed?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الأنواع الأكثر تأخرًا</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>النوع</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>المتأخر</TableHead>
                  <TableHead>نسبة التأخر</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.mostDelayed.map((d: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="num-ltr">{d.total}</TableCell>
                    <TableCell className="num-ltr text-red-600">{d.overdue}</TableCell>
                    <TableCell className="num-ltr">{d.delayRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Work records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">تفاصيل الأعمال ({report?.records?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {report?.records?.length ? (
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المعلم</TableHead>
                    <TableHead>العنوان</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>الاستحقاق</TableHead>
                    <TableHead>الإكمال</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.records.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.teacher}</TableCell>
                      <TableCell className="text-sm">{r.title}</TableCell>
                      <TableCell className="text-xs">{r.workType}</TableCell>
                      <TableCell className="num-ltr text-sm">{formatDate(r.dueDate)}</TableCell>
                      <TableCell className="num-ltr text-sm">{formatDate(r.completionDate)}</TableCell>
                      <TableCell>
                        <span className="text-xs">{STATUS_LABELS[r.status] || r.status}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="لا توجد أعمال في هذه الفترة" />
          )}
        </CardContent>
      </Card>

      {/* Substitutions summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ملخص الإشغالات ({report?.substitutions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {report?.substitutions?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحصة</TableHead>
                  <TableHead>المعلم الأصلي</TableHead>
                  <TableHead>البديل</TableHead>
                  <TableHead>الصف</TableHead>
                  <TableHead>السبب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.substitutions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="num-ltr text-sm">{formatDate(s.date)}</TableCell>
                    <TableCell className="num-ltr">{s.period}</TableCell>
                    <TableCell>{s.original || "—"}</TableCell>
                    <TableCell>{s.substitute}</TableCell>
                    <TableCell>{s.class}</TableCell>
                    <TableCell>
                      <span className="text-xs">{SUBSTITUTION_REASON_LABELS[s.reason] || s.reason}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد إشغالات في هذه الفترة" />
          )}
        </CardContent>
      </Card>

      {/* Departures summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ملخص المغادرات ({report?.departures?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {report?.departures?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المعلم</TableHead>
                  <TableHead>المغادرة</TableHead>
                  <TableHead>العودة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.departures.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="num-ltr text-sm">{formatDate(d.date)}</TableCell>
                    <TableCell className="font-medium">{d.teacher}</TableCell>
                    <TableCell className="num-ltr">{d.departureTime}</TableCell>
                    <TableCell className="num-ltr">{d.returnTime || "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs">{DEPARTURE_TYPE_LABELS[d.type] || d.type}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{APPROVAL_STATUS_LABELS[d.approvalStatus] || d.approvalStatus}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد مغادرات في هذه الفترة" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: "red" | "green" | "amber";
}) {
  const colorClass =
    highlight === "red"
      ? "text-red-600"
      : highlight === "green"
      ? "text-green-600"
      : highlight === "amber"
      ? "text-amber-600"
      : "";
  return (
    <div className="p-3 border border-border rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold num-ltr ${colorClass}`}>
        {value === null || value === undefined ? "—" : value}
      </p>
    </div>
  );
}
