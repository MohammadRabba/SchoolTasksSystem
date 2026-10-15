"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ApprovalBadge } from "@/components/common/StatusBadge";
import {
  DEPARTURE_TYPE_LABELS,
  PERMISSION_TYPE_LABELS,
  APPROVAL_STATUS_LABELS,
} from "@/lib/labels";
import { formatDate } from "@/lib/date-utils";
import { usePeriodRange, PeriodFilterTabs, usePeriodKey } from "@/components/common/PeriodFilter";
import { toast } from "sonner";
import { Plus, DoorOpen, CheckCircle, XCircle, Trash2 } from "lucide-react";

export function DeparturesView() {
  const range = usePeriodRange();
  const rangeKey = usePeriodKey();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [approvalTarget, setApprovalTarget] = useState<any | null>(null);

  useEffect(() => {
    void load();
  }, [rangeKey, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString().split("T")[0],
        end: range.end.toISOString().split("T")[0],
      });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/departures?${params}`);
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(status: "APPROVED" | "REJECTED" | "COMPLETED") {
    if (!approvalTarget) return;
    try {
      const res = await fetch(`/api/departures/${approvalTarget.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalStatus: status }),
      });
      if (res.ok) {
        toast.success("تم التحديث");
        setApprovalTarget(null);
        void load();
      }
    } catch {
      toast.error("خطأ");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/departures/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم الحذف");
        setDeleteTarget(null);
        void load();
      }
    } catch {
      toast.error("خطأ");
    }
  }

  // Calculate duration helper
  function calcDuration(dep: any): string {
    if (!dep.returnTime) return "—";
    const [dh, dm] = dep.departureTime.split(":").map(Number);
    const [rh, rm] = dep.returnTime.split(":").map(Number);
    let mins = (rh * 60 + rm) - (dh * 60 + dm);
    if (mins < 0) mins += 24 * 60; // overnight
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}س ${m}د`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">تقارير المغادرة</h2>
          <p className="text-sm text-muted-foreground">
            سجلات مغادرة المعلمين والموافقات
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter || "ALL"} onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">كل الحالات</SelectItem>
              <SelectItem value="PENDING">قيد المراجعة</SelectItem>
              <SelectItem value="APPROVED">موافق عليه</SelectItem>
              <SelectItem value="REJECTED">مرفوض</SelectItem>
              <SelectItem value="COMPLETED">مكتمل</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            تسجيل مغادرة
          </Button>
        </div>
      </div>

      <PeriodFilterTabs />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="لا توجد مغادرات"
              description="ابدأ بتسجيل أول مغادرة"
              icon={<DoorOpen className="w-6 h-6" />}
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  تسجيل مغادرة
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>المعلم</TableHead>
                  <TableHead>المغادرة</TableHead>
                  <TableHead>العودة</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="num-ltr text-sm">{formatDate(d.departureDate)}</TableCell>
                    <TableCell className="font-medium">{d.teacher?.fullName}</TableCell>
                    <TableCell className="num-ltr">{d.departureTime}</TableCell>
                    <TableCell className="num-ltr">{d.returnTime || "—"}</TableCell>
                    <TableCell className="num-ltr text-xs">{calcDuration(d)}</TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {DEPARTURE_TYPE_LABELS[d.departureType] || d.departureType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ApprovalBadge
                        status={d.approvalStatus}
                        label={APPROVAL_STATUS_LABELS[d.approvalStatus]}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {d.approvalStatus === "PENDING" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setApprovalTarget({ ...d, action: "APPROVED" })}
                              className="text-green-600"
                              title="موافقة"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setApprovalTarget({ ...d, action: "REJECTED" })}
                              className="text-destructive"
                              title="رفض"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(d)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DepartureFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSaved={() => {
          setShowForm(false);
          void load();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل المغادرة نهائيًا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!approvalTarget}
        onOpenChange={(o) => !o && setApprovalTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {approvalTarget?.action === "APPROVED" ? "تأكيد الموافقة" : "تأكيد الرفض"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {approvalTarget?.action === "APPROVED"
                ? "سيتم اعتماد طلب المغادرة."
                : "سيتم رفض طلب المغادرة."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approvalTarget && handleApprove(approvalTarget.action)}
            >
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DepartureFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [departureDate, setDepartureDate] = useState(new Date().toISOString().split("T")[0]);
  const [departureTime, setDepartureTime] = useState("08:00");
  const [returnTime, setReturnTime] = useState("");
  const [departureType, setDepartureType] = useState("PERSONAL");
  const [reason, setReason] = useState("");
  const [permissionType, setPermissionType] = useState("PRE_APPROVED");
  const [affectedPeriodCount, setAffectedPeriodCount] = useState(0);
  const [coverageArrangements, setCoverageArrangements] = useState("");
  const [administrativeNotes, setAdministrativeNotes] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/teachers?pageSize=1000")
      .then((r) => r.json())
      .then((d) => setTeachers(d.data || []));
  }, []);

  useEffect(() => {
    if (open) {
      setTeacherId("");
      setDepartureDate(new Date().toISOString().split("T")[0]);
      setDepartureTime("08:00");
      setReturnTime("");
      setDepartureType("PERSONAL");
      setReason("");
      setPermissionType("PRE_APPROVED");
      setAffectedPeriodCount(0);
      setCoverageArrangements("");
      setAdministrativeNotes("");
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId) {
      toast.error("المعلم مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        teacherId,
        departureDate,
        departureTime,
        returnTime: returnTime || null,
        departureType,
        reason: reason.trim() || null,
        permissionType,
        approvalStatus: "PENDING",
        affectedPeriodCount: Number(affectedPeriodCount) || 0,
        coverageArrangements: coverageArrangements.trim() || null,
        administrativeNotes: administrativeNotes.trim() || null,
      };
      const res = await fetch("/api/departures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل");
      } else {
        toast.success("تم تسجيل المغادرة");
        onSaved();
      }
    } catch {
      toast.error("خطأ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تسجيل مغادرة</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>المعلم *</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر..." />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>وقت المغادرة *</Label>
              <Input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>وقت العودة</Label>
              <Input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={departureType} onValueChange={setDepartureType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL">شخصي</SelectItem>
                  <SelectItem value="MEDICAL">طبي</SelectItem>
                  <SelectItem value="OFFICIAL">رسمي</SelectItem>
                  <SelectItem value="EMERGENCY">طارئ</SelectItem>
                  <SelectItem value="OTHER">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>نوع الإذن</Label>
              <Select value={permissionType} onValueChange={setPermissionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRE_APPROVED">موافق عليه مسبقًا</SelectItem>
                  <SelectItem value="EMERGENCY">طارئ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد الحصص المتأثرة</Label>
              <Input
                type="number"
                min={0}
                value={affectedPeriodCount}
                onChange={(e) => setAffectedPeriodCount(Number(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>السبب</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>ترتيبات التغطية</Label>
            <Textarea value={coverageArrangements} onChange={(e) => setCoverageArrangements(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>ملاحظات إدارية</Label>
            <Textarea value={administrativeNotes} onChange={(e) => setAdministrativeNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
