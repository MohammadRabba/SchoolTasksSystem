"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppStore } from "@/store/useAppStore";
import { formatDate } from "@/lib/date-utils";
import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  DEPARTURE_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
  SUBSTITUTION_REASON_LABELS,
} from "@/lib/labels";
import { toast } from "sonner";
import {
  AlertCircle,
  ClipboardList,
  DoorOpen,
  Calendar,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

export function PendingActionsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const setView = useAppStore((s) => s.setView);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/pending");
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error("فشل التحميل");
      }
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function bulkApproveSubmitted() {
    const ids = data?.submittedRecords?.map((r: any) => r.id) || [];
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/work-records/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: ids }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(`تم اعتماد ${d.approved} سجل عمل`);
        void load();
      } else {
        toast.error(d.error || "فشل");
      }
    } catch {
      toast.error("خطأ");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const c = data?.counts || { total: 0, submitted: 0, pendingDepartures: 0, unassignedSubs: 0, overdue: 0 };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">إجراءات معلّقة</h2>
        <p className="text-sm text-muted-foreground">
          جميع الأعمال التي تحتاج تدخلك في صفحة واحدة — معالجة سريعة صباح كل يوم
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={c.submitted > 0 ? "border-teal-500/30" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">سجلات بانتظار الاعتماد</span>
              <ClipboardList className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-2xl font-bold num-ltr">{c.submitted}</p>
          </CardContent>
        </Card>
        <Card className={c.pendingDepartures > 0 ? "border-amber-500/30" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">مغادرات معلّقة</span>
              <DoorOpen className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold num-ltr">{c.pendingDepartures}</p>
          </CardContent>
        </Card>
        <Card className={c.unassignedSubs > 0 ? "border-orange-500/30" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">إشغالات غير معينة</span>
              <Calendar className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-2xl font-bold num-ltr">{c.unassignedSubs}</p>
          </CardContent>
        </Card>
        <Card className={c.overdue > 0 ? "border-red-500/30" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">أعمال متأخرة</span>
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold num-ltr">{c.overdue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Submitted records */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              سجلات بانتظار الاعتماد ({c.submitted})
            </CardTitle>
            {c.submitted > 0 && (
              <Button size="sm" onClick={bulkApproveSubmitted}>
                <CheckCircle2 className="w-3 h-3 ml-1" />
                اعتماد الكل
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {data?.submittedRecords?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعلم</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.submittedRecords.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.teacherName}</TableCell>
                    <TableCell>{r.assignmentTitle}</TableCell>
                    <TableCell className="text-xs">{r.workType}</TableCell>
                    <TableCell className="num-ltr text-sm">{formatDate(r.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-teal-50 text-teal-700">
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setView("assignments")}
                      >
                        فتح التكليف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد سجلات بانتظار الاعتماد" />
          )}
        </CardContent>
      </Card>

      {/* Pending departures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DoorOpen className="w-4 h-4" />
            مغادرات معلّقة الموافقة ({c.pendingDepartures})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.pendingDepartures?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعلم</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المغادرة</TableHead>
                  <TableHead>العودة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pendingDepartures.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.teacherName}</TableCell>
                    <TableCell className="num-ltr text-sm">{formatDate(d.departureDate)}</TableCell>
                    <TableCell className="num-ltr">{d.departureTime}</TableCell>
                    <TableCell className="num-ltr">{d.returnTime || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {DEPARTURE_TYPE_LABELS[d.departureType] || d.departureType}
                    </TableCell>
                    <TableCell className="text-xs">{d.reason}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setView("departures")}
                      >
                        معالجة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد مغادرات معلّقة" />
          )}
        </CardContent>
      </Card>

      {/* Unassigned substitutions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            إشغالات غير معينة ({c.unassignedSubs})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.unassignedSubs?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحصة</TableHead>
                  <TableHead>الصف</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>المعلم الأصلي</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.unassignedSubs.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="num-ltr text-sm">{formatDate(s.substitutionDate)}</TableCell>
                    <TableCell className="num-ltr">{s.periodNumber}</TableCell>
                    <TableCell>{s.className} {s.sectionName && `(${s.sectionName})`}</TableCell>
                    <TableCell className="text-xs">
                      {SUBSTITUTION_REASON_LABELS[s.reasonType] || s.reasonType}
                    </TableCell>
                    <TableCell>{s.originalTeacher || "—"}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setView("substitutions")}
                      >
                        تعيين بديل
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="لا توجد إشغالات غير معينة" />
          )}
        </CardContent>
      </Card>

      {/* Overdue records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            أعمال متأخرة ({c.overdue})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.overdueRecords?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المعلم</TableHead>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الاستحقاق</TableHead>
                  <TableHead>التأخير (أيام)</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdueRecords.map((r: any) => (
                  <TableRow key={r.id} className="bg-red-50/30">
                    <TableCell className="font-medium">{r.teacherName}</TableCell>
                    <TableCell>{r.assignmentTitle}</TableCell>
                    <TableCell className="text-xs">{r.workType}</TableCell>
                    <TableCell className="num-ltr text-sm text-red-700">{formatDate(r.dueDate)}</TableCell>
                    <TableCell className="num-ltr font-medium text-red-700">{r.daysOverdue}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setView("assignments")}
                      >
                        فتح
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              title="لا توجد أعمال متأخرة 🎉"
              description="جميع الأعمال مكتملة أو ضمن الموعد المحدد"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
