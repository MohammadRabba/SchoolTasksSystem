"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { SUBSTITUTION_REASON_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/date-utils";
import { usePeriodRange, PeriodFilterTabs, usePeriodKey } from "@/components/common/PeriodFilter";
import { toast } from "sonner";
import { Plus, Calendar as CalIcon, Trash2, AlertTriangle, Edit } from "lucide-react";

export function SubstitutionsView() {
  const range = usePeriodRange();
  const rangeKey = usePeriodKey();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  useEffect(() => {
    void load();
  }, [rangeKey, unassignedOnly]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString().split("T")[0],
        end: range.end.toISOString().split("T")[0],
      });
      if (unassignedOnly) params.set("unassigned", "true");
      const res = await fetch(`/api/substitutions?${params}`);
      const data = await res.json();
      if (res.ok) setItems(data);
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/substitutions/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم الحذف");
        setDeleteTarget(null);
        void load();
      }
    } catch {
      toast.error("خطأ");
    }
  }

  const totalPeriods = items.reduce((s, x) => s + (x.numberOfPeriods || 1), 0);
  const unassignedCount = items.filter((x) => !x.substituteTeacherId).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">حصص الإشغالات</h2>
          <p className="text-sm text-muted-foreground">
            إجمالي الحصص: {totalPeriods} — سجلات غير معينة: {unassignedCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={unassignedOnly ? "destructive" : "outline"}
            size="sm"
            onClick={() => setUnassignedOnly((v) => !v)}
          >
            <AlertTriangle className="w-4 h-4 ml-1" />
            {unassignedOnly ? "إظهار الكل" : "غير المعينة فقط"}
          </Button>
          <Button onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة إشغال
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
              title="لا توجد إشغالات"
              description="ابدأ بتسجيل أول حصة إشغال"
              icon={<CalIcon className="w-6 h-6" />}
              action={
                <Button onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة إشغال
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الحصة</TableHead>
                  <TableHead>المعلم الأصلي</TableHead>
                  <TableHead>المعلم البديل</TableHead>
                  <TableHead>الصف</TableHead>
                  <TableHead>السبب</TableHead>
                  <TableHead>عدد الحصص</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow
                    key={s.id}
                    className={s.substituteTeacherId ? "" : "bg-amber-50/40"}
                  >
                    <TableCell className="num-ltr text-sm">{formatDate(s.substitutionDate)}</TableCell>
                    <TableCell className="num-ltr">{s.periodNumber}</TableCell>
                    <TableCell>{s.originalTeacher?.fullName || "—"}</TableCell>
                    <TableCell>
                      {s.substituteTeacher ? (
                        s.substituteTeacher.fullName
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">
                          غير معين
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{s.className} {s.sectionName && `(${s.sectionName})`}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SUBSTITUTION_REASON_LABELS[s.reasonType] || s.reasonType}
                      </Badge>
                    </TableCell>
                    <TableCell className="num-ltr">{s.numberOfPeriods}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(s);
                            setShowForm(true);
                          }}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(s)}
                          className="text-destructive"
                          title="حذف"
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

      <SubstitutionFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        editing={editing}
        onSaved={() => {
          setShowForm(false);
          setEditing(null);
          void load();
        }}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف سجل الإشغال نهائيًا. لا يمكن التراجع عن هذا الإجراء.
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
    </div>
  );
}

function SubstitutionFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [periodNumber, setPeriodNumber] = useState(1);
  const [periodStartTime, setPeriodStartTime] = useState("");
  const [periodEndTime, setPeriodEndTime] = useState("");
  const [originalTeacherId, setOriginalTeacherId] = useState("");
  const [substituteTeacherId, setSubstituteTeacherId] = useState("");
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [reasonType, setReasonType] = useState("ABSENCE");
  const [customReason, setCustomReason] = useState("");
  const [numberOfPeriods, setNumberOfPeriods] = useState(1);
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
      if (editing) {
        // Pre-populate fields from the substitution being edited
        setDate(editing.substitutionDate ? editing.substitutionDate.split("T")[0] : new Date().toISOString().split("T")[0]);
        setPeriodNumber(editing.periodNumber || 1);
        setPeriodStartTime(editing.periodStartTime || "");
        setPeriodEndTime(editing.periodEndTime || "");
        setOriginalTeacherId(editing.originalTeacherId || "");
        setSubstituteTeacherId(editing.substituteTeacherId || "");
        setClassName(editing.className || "");
        setSectionName(editing.sectionName || "");
        setReasonType(editing.reasonType || "ABSENCE");
        setCustomReason(editing.customReason || "");
        setNumberOfPeriods(editing.numberOfPeriods || 1);
        setAdministrativeNotes(editing.administrativeNotes || "");
      } else {
        // Fresh form — reset to defaults
        setDate(new Date().toISOString().split("T")[0]);
        setPeriodNumber(1);
        setPeriodStartTime("");
        setPeriodEndTime("");
        setOriginalTeacherId("");
        setSubstituteTeacherId("");
        setClassName("");
        setSectionName("");
        setReasonType("ABSENCE");
        setCustomReason("");
        setNumberOfPeriods(1);
        setAdministrativeNotes("");
      }
    }
  }, [open, editing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!className.trim() || !date) {
      toast.error("التاريخ والصف مطلوبان");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        substitutionDate: date,
        periodNumber: Number(periodNumber),
        periodStartTime: periodStartTime || null,
        periodEndTime: periodEndTime || null,
        originalTeacherId: originalTeacherId || null,
        substituteTeacherId: substituteTeacherId || null,
        className: className.trim(),
        sectionName: sectionName.trim() || null,
        reasonType,
        customReason: customReason.trim() || null,
        numberOfPeriods: Number(numberOfPeriods),
        administrativeNotes: administrativeNotes.trim() || null,
      };
      const url = editing ? `/api/substitutions/${editing.id}` : "/api/substitutions";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل");
      } else {
        toast.success(editing ? "تم تحديث الإشغال" : "تمت الإضافة");
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
          <DialogTitle>{editing ? "تعديل إشغال" : "تسجيل إشغال جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>التاريخ *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" required />
            </div>
            <div className="space-y-2">
              <Label>رقم الحصة *</Label>
              <Input
                type="number"
                min={1}
                value={periodNumber}
                onChange={(e) => setPeriodNumber(Number(e.target.value))}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>بداية الحصة</Label>
              <Input type="time" value={periodStartTime} onChange={(e) => setPeriodStartTime(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>نهاية الحصة</Label>
              <Input type="time" value={periodEndTime} onChange={(e) => setPeriodEndTime(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>المعلم الأصلي</Label>
              <Select value={originalTeacherId} onValueChange={setOriginalTeacherId}>
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
              <Label>المعلم البديل</Label>
              <Select value={substituteTeacherId} onValueChange={setSubstituteTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="غير معين" />
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
              <Label>الصف *</Label>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} required placeholder="مثال: الثامن" />
            </div>
            <div className="space-y-2">
              <Label>الشعبة</Label>
              <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="أ، ب" />
            </div>
            <div className="space-y-2">
              <Label>السبب</Label>
              <Select value={reasonType} onValueChange={setReasonType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABSENCE">غياب المعلم</SelectItem>
                  <SelectItem value="DEPARTURE_LEAVE">مغادرة/إجازة</SelectItem>
                  <SelectItem value="ADMIN_ASSIGNMENT">تكليف إداري</SelectItem>
                  <SelectItem value="EMERGENCY">طارئ</SelectItem>
                  <SelectItem value="OTHER">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>عدد الحصص</Label>
              <Input
                type="number"
                min={1}
                value={numberOfPeriods}
                onChange={(e) => setNumberOfPeriods(Number(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>
          {reasonType === "OTHER" && (
            <div className="space-y-2">
              <Label>السبب المخصص</Label>
              <Input value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>ملاحظات إدارية</Label>
            <Textarea value={administrativeNotes} onChange={(e) => setAdministrativeNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
