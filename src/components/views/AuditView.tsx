"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/date-utils";
import { toast } from "sonner";
import { History } from "lucide-react";

export function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionType, setActionType] = useState("");
  const [entityType, setEntityType] = useState("");

  useEffect(() => {
    setPage(1);
  }, [actionType, entityType]);

  useEffect(() => {
    void load();
  }, [page, actionType, entityType]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "30",
      });
      if (actionType) params.set("actionType", actionType);
      if (entityType) params.set("entityType", entityType);
      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">سجل التدقيق</h2>
        <p className="text-sm text-muted-foreground">
          سجل كامل لجميع العمليات الإدارية — {total} سجل
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={actionType || "ALL"} onValueChange={(v) => setActionType(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="كل العمليات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">كل العمليات</SelectItem>
                <SelectItem value="CREATE">إنشاء</SelectItem>
                <SelectItem value="UPDATE">تعديل</SelectItem>
                <SelectItem value="DELETE">حذف</SelectItem>
                <SelectItem value="ARCHIVE">أرشفة</SelectItem>
                <SelectItem value="APPROVE">اعتماد</SelectItem>
                <SelectItem value="REJECT">رفض</SelectItem>
                <SelectItem value="IMPORT">استيراد</SelectItem>
                <SelectItem value="SETUP">إعداد</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityType || "ALL"} onValueChange={(v) => setEntityType(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="كل الأنواع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">كل الأنواع</SelectItem>
                <SelectItem value="Admin">المدير</SelectItem>
                <SelectItem value="Teacher">معلم</SelectItem>
                <SelectItem value="WorkType">نوع عمل</SelectItem>
                <SelectItem value="Assignment">تكليف</SelectItem>
                <SelectItem value="WorkRecord">سجل عمل</SelectItem>
                <SelectItem value="Substitution">إشغال</SelectItem>
                <SelectItem value="Departure">مغادرة</SelectItem>
                <SelectItem value="SchoolYear">عام دراسي</SelectItem>
                <SelectItem value="Settings">إعدادات</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              title="لا توجد سجلات"
              description="ستظهر هنا جميع العمليات التي يقوم بها المدير"
              icon={<History className="w-6 h-6" />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العملية</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المعرف</TableHead>
                  <TableHead>المدير</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Badge variant="outline">{l.actionType}</Badge>
                    </TableCell>
                    <TableCell>{l.entityType}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.entityId ? l.entityId.slice(-8) : "—"}
                    </TableCell>
                    <TableCell>{l.administrator?.name || "—"}</TableCell>
                    <TableCell className="num-ltr text-sm">
                      {formatDateTime(l.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50"
            >
              السابق
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm border border-border rounded hover:bg-muted disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
