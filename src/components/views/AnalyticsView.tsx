"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { PeriodFilterTabs, usePeriodRange, usePeriodKey } from "@/components/common/PeriodFilter";
import { toast } from "sonner";
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

const COLORS = ["#1e40af", "#0d9488", "#16a34a", "#f59e0b", "#dc2626", "#6b7280", "#7c3aed", "#ec4899"];

export function AnalyticsView() {
  const range = usePeriodRange();
  const rangeKey = usePeriodKey();
  const [charts, setCharts] = useState<any>(null);
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
      const res = await fetch(`/api/dashboard/charts?${params}`);
      if (res.ok) setCharts(await res.json());
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">التحليلات</h2>
        <p className="text-sm text-muted-foreground">
          رسوم بيانية تفاعلية بناءً على البيانات الحقيقية
        </p>
      </div>

      <PeriodFilterTabs />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع حالة الأعمال</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.statusDistribution?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={charts.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(d: any) => `${d.name}: ${d.value}`}
                  >
                    {charts.statusDistribution.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد بيانات كافية" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">المطلوب مقابل المكتمل والمعتمد والمتأخر</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.requiredVsCompleted?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.requiredVsCompleted}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" name="العدد" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد بيانات" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الإشغالات حسب المعلم البديل</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.subsByTeacher?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.subsByTeacher.slice(0, 12)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="periods" name="عدد الحصص" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد إشغالات" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">الأعمال المتأخرة حسب النوع</CardTitle>
          </CardHeader>
          <CardContent>
            {charts?.overdueByCategory?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={charts.overdueByCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="العدد" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="لا توجد أعمال متأخرة" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">اتجاه الإنجاز الشهري</CardTitle>
        </CardHeader>
        <CardContent>
          {charts?.monthlyTrend?.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={charts.monthlyTrend}>
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
            <EmptyState title="لا توجد بيانات كافية لعرض الاتجاه" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
