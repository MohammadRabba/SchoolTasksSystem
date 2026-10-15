"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { FREQUENCY_LABELS, PRIORITY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  Plus,
  Repeat,
  Edit,
  Trash2,
  Play,
  Pause,
  Users,
  Calendar,
} from "lucide-react";

const WEEKDAYS = [
  { key: "SUN", label: "الأحد" },
  { key: "MON", label: "الإثنين" },
  { key: "TUE", label: "الثلاثاء" },
  { key: "WED", label: "الأربعاء" },
  { key: "THU", label: "الخميس" },
  { key: "FRI", label: "الجمعة" },
  { key: "SAT", label: "السبت" },
];

export function RecurringAssignmentsView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/recurring-assignments");
      if (res.ok) setItems(await res.json());
    } catch {
      toast.error("فشل التحميل");
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setRunning(true);
    try {
      const res = await fetch("/api/recurring-assignments/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم توليد ${data.created} تكليف جديد (${data.processed} مجدول، ${data.skipped} تخطي)`);
        void load();
      } else {
        toast.error(data.error || "فشل التوليد");
      }
    } catch {
      toast.error("خطأ");
    } finally {
      setRunning(false);
    }
  }

  async function toggleActive(item: any) {
    try {
      const res = await fetch(`/api/recurring-assignments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        toast.success(item.isActive ? "تم إيقاف التكليف التلقائي" : "تم تفعيل التكليف التلقائي");
        void load();
      }
    } catch {
      toast.error("خطأ");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/recurring-assignments/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success("تم الحذف");
        setDeleteTarget(null);
        void load();
      } else {
        toast.error(data.error || "فشل الحذف");
      }
    } catch {
      toast.error("خطأ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">التكليفات التلقائية</h2>
          <p className="text-sm text-muted-foreground">
            جداول تكليفات متكررة — يولّد النظام تكليفات يومية تلقائيًا بناءً على الجدول
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRun} disabled={running}>
            <Play className="w-4 h-4 ml-2" />
            {running ? "جاري التوليد..." : "توليد التكليفات المستحقة"}
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة جدول تكليف
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 bg-accent/20 border-b">
          <div className="text-sm space-y-1">
            <p className="font-medium">كيف يعمل التكليف التلقائي؟</p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
              <li>تحدد نوع العمل (مثل: سجل الحضور اليومي) + المعلمين + الأيام + فترة الجدول</li>
              <li>عند الضغط على "توليد التكليفات المستحقة"، يفحص النظام كل الجداول النشطة</li>
              <li>يُنشئ تكليفًا لكل يوم لم يُولَّد بعد ضمن الفترة المحددة — بدون تكرار</li>
              <li>تاريخ الاستحقاق = تاريخ التكليف + عدد أيام التأجيل (افتراضي: 0 = نفس اليوم)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="لا توجد جداول تكليف تلقائي"
              description="ابدأ بإضافة جدول — مثل: سجل الحضور اليومي لجميع المعلمين من الأحد إلى الخميس"
              icon={<Repeat className="w-6 h-6" />}
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة جدول تكليف
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>التكرار</TableHead>
                  <TableHead>الأيام</TableHead>
                  <TableHead>الفترة</TableHead>
                  <TableHead>تأجيل الاستحقاق</TableHead>
                  <TableHead>المعلمون</TableHead>
                  <TableHead>المُولَّد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-xs">{r.workType?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FREQUENCY_LABELS[r.frequency] || r.frequency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDays(r.frequency, r.daysOfWeek)}
                    </TableCell>
                    <TableCell className="text-xs num-ltr">
                      {formatDate(r.startDate)} → {formatDate(r.endDate)}
                    </TableCell>
                    <TableCell className="num-ltr text-xs">
                      {r.dueOffsetDays === 0 ? "نفس اليوم" : `+${r.dueOffsetDays} يوم`}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {r.teachers?.length || 0}
                      </span>
                    </TableCell>
                    <TableCell className="num-ltr text-xs">
                      {r._count?.assignments || 0} تكليف
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.isActive ? "default" : "secondary"}>
                        {r.isActive ? "نشط" : "متوقف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(r);
                            setShowForm(true);
                          }}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(r)}
                          title={r.isActive ? "إيقاف" : "تفعيل"}
                        >
                          {r.isActive ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(r)}
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

      <RecurringFormDialog
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
              سيتم حذف الجدول &quot;{deleteTarget?.title}&quot;. لا يمكن الحذف إذا وُجدت تكليفات نشطة مُولَّدة منه.
              يُفضّل استخدام زر الإيقاف (⏸) بدلاً من الحذف.
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

function formatDays(frequency: string, daysOfWeek: string): string {
  const days = daysOfWeek.split(",").map((x) => x.trim()).filter(Boolean);
  if (days.length === 0) return "—";
  if (frequency === "DAILY" || frequency === "WEEKLY") {
    return days
      .map((d) => WEEKDAYS.find((w) => w.key === d)?.label || d)
      .join("، ");
  }
  if (frequency === "MONTHLY") {
    return `أيام الشهر: ${days.join(", ")}`;
  }
  return days.join(", ");
}

function RecurringFormDialog({
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["SUN", "MON", "TUE", "WED", "THU"]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dueOffsetDays, setDueOffsetDays] = useState(0);
  const [priority, setPriority] = useState("NORMAL");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [schoolPeriodId, setSchoolPeriodId] = useState("");
  const [adminInstructions, setAdminInstructions] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadOptions();
  }, []);

  async function loadOptions() {
    const [wtRes, tRes, yRes] = await Promise.all([
      fetch("/api/work-types"),
      fetch("/api/teachers?pageSize=1000"),
      fetch("/api/school-years"),
    ]);
    if (wtRes.ok) setWorkTypes(await wtRes.json());
    if (tRes.ok) {
      const d = await tRes.json();
      setTeachers(d.data || []);
    }
    if (yRes.ok) setSchoolYears(await yRes.json());
  }

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title || "");
      setDescription(editing.description || "");
      setWorkTypeId(editing.workTypeId || "");
      setFrequency(editing.frequency || "DAILY");
      setDaysOfWeek(editing.daysOfWeek ? editing.daysOfWeek.split(",").filter(Boolean) : []);
      setStartDate(editing.startDate ? editing.startDate.split("T")[0] : "");
      setEndDate(editing.endDate ? editing.endDate.split("T")[0] : "");
      setDueOffsetDays(editing.dueOffsetDays || 0);
      setPriority(editing.priority || "NORMAL");
      setSchoolYearId(editing.schoolYearId || "");
      setSchoolPeriodId(editing.schoolPeriodId || "");
      setAdminInstructions(editing.adminInstructions || "");
      setIsActive(editing.isActive ?? true);
      setSelectedTeachers(editing.teachers?.map((t: any) => t.teacherId) || []);
    } else {
      const today = new Date().toISOString().split("T")[0];
      const endDefault = new Date();
      endDefault.setMonth(endDefault.getMonth() + 3);
      setTitle("");
      setDescription("");
      setWorkTypeId("");
      setFrequency("DAILY");
      setDaysOfWeek(["SUN", "MON", "TUE", "WED", "THU"]);
      setStartDate(today);
      setEndDate(endDefault.toISOString().split("T")[0]);
      setDueOffsetDays(0);
      setPriority("NORMAL");
      const activeYear = schoolYears.find((y) => y.isActive);
      setSchoolYearId(activeYear?.id || schoolYears[0]?.id || "");
      setSchoolPeriodId("");
      setAdminInstructions("");
      setIsActive(true);
      setSelectedTeachers([]);
    }
  }, [editing, open, schoolYears]);

  function toggleDay(day: string) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleTeacher(id: string) {
    setSelectedTeachers((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleSelectAllTeachers() {
    if (teachers.length > 0 && selectedTeachers.length === teachers.length) {
      setSelectedTeachers([]);
    } else {
      setSelectedTeachers(teachers.map((t) => t.id));
    }
  }

  const allTeachersSelected =
    teachers.length > 0 && selectedTeachers.length === teachers.length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !workTypeId || !startDate || !endDate || !schoolYearId) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    if (daysOfWeek.length === 0) {
      toast.error("اختر يومًا واحدًا على الأقل");
      return;
    }
    if (selectedTeachers.length === 0) {
      toast.error("اختر معلمًا واحدًا على الأقل");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        workTypeId,
        frequency,
        daysOfWeek: frequency === "MONTHLY"
          ? daysOfWeek.join(",")
          : daysOfWeek.join(","),
        startDate,
        endDate,
        dueOffsetDays: Number(dueOffsetDays) || 0,
        priority,
        schoolYearId,
        schoolPeriodId: schoolPeriodId || null,
        adminInstructions: adminInstructions.trim() || null,
        isActive,
        teacherIds: selectedTeachers,
      };
      const url = editing ? `/api/recurring-assignments/${editing.id}` : "/api/recurring-assignments";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل الحفظ");
      } else {
        toast.success(editing ? "تم التحديث" : "تم إنشاء الجدول");
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل جدول تكليف تلقائي" : "إنشاء جدول تكليف تلقائي جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان التكليف *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: سجل الحضور اليومي"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>نوع العمل *</Label>
              <Select value={workTypeId} onValueChange={setWorkTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر..." />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.filter((w) => w.isActive).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تكرار التكليف</Label>
              <Select
                value={frequency}
                onValueChange={(v) => {
                  setFrequency(v as any);
                  if (v === "DAILY") setDaysOfWeek(["SUN", "MON", "TUE", "WED", "THU"]);
                  else if (v === "WEEKLY") setDaysOfWeek(["SUN"]);
                  else if (v === "MONTHLY") setDaysOfWeek(["1", "15"]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">يومي (أيام محددة من الأسبوع)</SelectItem>
                  <SelectItem value="WEEKLY">أسبوعي (يوم محدد من الأسبوع)</SelectItem>
                  <SelectItem value="MONTHLY">شهري (أيام محددة من الشهر)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Days of week / month */}
          <div className="space-y-2">
            <Label>
              {frequency === "MONTHLY" ? "أيام الشهر (1-31)" : "أيام الأسبوع *"}
            </Label>
            {frequency === "MONTHLY" ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <label
                    key={day}
                    className={`flex items-center justify-center w-9 h-9 rounded-md cursor-pointer border text-sm transition-colors ${
                      daysOfWeek.includes(String(day))
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={daysOfWeek.includes(String(day))}
                      onChange={() => toggleDay(String(day))}
                      className="sr-only"
                    />
                    <span className="num-ltr">{day}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border text-sm transition-colors ${
                      daysOfWeek.includes(d.key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={daysOfWeek.includes(d.key)}
                      onChange={() => toggleDay(d.key)}
                      className="sr-only"
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {daysOfWeek.length === 0 ? "لم يتم اختيار أي يوم" : `${daysOfWeek.length} يوم محدد`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>تاريخ بدء الجدول *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" required />
            </div>
            <div className="space-y-2">
              <Label>تاريخ نهاية الجدول *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>تأجيل تاريخ الاستحقاق (أيام)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={dueOffsetDays}
                onChange={(e) => setDueOffsetDays(Number(e.target.value))}
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                0 = نفس اليوم | 1 = اليوم التالي | إلخ
              </p>
            </div>
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">منخفضة</SelectItem>
                  <SelectItem value="NORMAL">عادية</SelectItem>
                  <SelectItem value="HIGH">عالية</SelectItem>
                  <SelectItem value="URGENT">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>العام الدراسي *</Label>
              <Select value={schoolYearId} onValueChange={setSchoolYearId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name} {y.isActive && "(نشط)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفصل الدراسي</Label>
              <Select value={schoolPeriodId} onValueChange={setSchoolPeriodId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختياري" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.find((y) => y.id === schoolYearId)?.terms?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>تعليمات إدارية</Label>
            <Textarea value={adminInstructions} onChange={(e) => setAdminInstructions(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>المعلمون المكلفون * ({selectedTeachers.length} مختار)</Label>
              {teachers.length > 0 && (
                <label className="flex items-center gap-2 text-xs font-medium text-primary cursor-pointer hover:text-primary/80">
                  <input
                    type="checkbox"
                    checked={allTeachersSelected}
                    onChange={toggleSelectAllTeachers}
                    className="w-4 h-4"
                  />
                  {allTeachersSelected ? "إلغاء تحديد الكل" : "تحديد جميع المعلمين"}
                </label>
              )}
            </div>
            <div className="max-h-48 overflow-y-auto border border-border rounded-md p-2 space-y-1">
              {teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-2">
                  لا يوجد معلمون مسجلون
                </p>
              ) : (
                teachers.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeachers.includes(t.id)}
                      onChange={() => toggleTeacher(t.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{t.fullName}</span>
                    {t.specialization && (
                      <span className="text-xs text-muted-foreground">— {t.specialization}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <p className="font-medium">نشط</p>
              <p className="text-xs text-muted-foreground">يتم توليد التكليفات فقط للجداول النشطة</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : editing ? "حفظ التعديلات" : "إنشاء الجدول"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
