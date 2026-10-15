"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAppStore } from "@/store/useAppStore";
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
  DialogTrigger,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { EmploymentBadge } from "@/components/common/StatusBadge";
import { EMPLOYMENT_STATUS_LABELS, STATUS_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { Plus, Search, Users, Edit, Archive, Eye, Trash2 } from "lucide-react";

export function TeachersView() {
  const setView = useAppStore((s) => s.setView);
  const setSelectedTeacherId = useAppStore((s) => s.setSelectedTeacherId);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);

  function openTeacherDetail(teacher: any) {
    setSelectedTeacherId(teacher.id);
    setView("teacher-detail");
  }

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [search, statusFilter, page]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/teachers?${params}`);
      const data = await res.json();
      if (res.ok) {
        setTeachers(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || "فشل التحميل");
      }
    } catch {
      toast.error("حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      const res = await fetch(`/api/teachers/${archiveTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تمت أرشفة المعلم");
        setArchiveTarget(null);
        void load();
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">إدارة المعلمين</h2>
          <p className="text-sm text-muted-foreground">
            إجمالي المعلمين: {total}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة معلم
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter || "ALL"} onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="كل الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">كل الحالات</SelectItem>
                <SelectItem value="ACTIVE">في الخدمة</SelectItem>
                <SelectItem value="ON_LEAVE">في إجازة</SelectItem>
                <SelectItem value="INACTIVE">غير نشط</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <EmptyState
              title="لا يوجد معلمون"
              description="ابدأ بإضافة أول معلم للبدء في تتبع الأعمال الكتابية"
              icon={<Users className="w-6 h-6" />}
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة معلم
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الرقم الوظيفي</TableHead>
                  <TableHead>التخصص</TableHead>
                  <TableHead>المواد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ التعيين</TableHead>
                  <TableHead className="text-left">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((t) => (
                  <TableRow
                    key={t.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => openTeacherDetail(t)}
                  >
                    <TableCell className="font-medium">
                      <span className="hover:text-primary hover:underline">{t.fullName}</span>
                    </TableCell>
                    <TableCell className="num-ltr">{t.employeeNumber || "—"}</TableCell>
                    <TableCell>{t.specialization || "—"}</TableCell>
                    <TableCell className="text-xs">{t.subjects || "—"}</TableCell>
                    <TableCell>
                      <EmploymentBadge
                        status={t.employmentStatus}
                        label={EMPLOYMENT_STATUS_LABELS[t.employmentStatus]}
                      />
                    </TableCell>
                    <TableCell className="num-ltr text-sm">
                      {formatDate(t.employmentStartDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openTeacherDetail(t)}
                          title="عرض التحليلات"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(t);
                            setShowForm(true);
                          }}
                          title="تعديل"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setArchiveTarget(t)}
                          title="أرشفة"
                          className="text-destructive"
                        >
                          <Archive className="w-4 h-4" />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              السابق
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              التالي
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      <TeacherFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        teacher={editing}
        onSaved={() => {
          setShowForm(false);
          void load();
        }}
      />

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(o) => !o && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الأرشفة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم أرشفة المعلم "{archiveTarget?.fullName}" وتعيين حالته إلى "غير نشط".
              ستُحتفظ بسجلاته التاريخية. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground"
            >
              تأكيد الأرشفة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile drawer */}
      <TeacherProfileDrawer teacher={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function TeacherFormDialog({
  open,
  onOpenChange,
  teacher,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teacher: any | null;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [subjects, setSubjects] = useState("");
  const [weeklyPeriodCount, setWeeklyPeriodCount] = useState(0);
  const [employmentStartDate, setEmploymentStartDate] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("ACTIVE");
  const [administrativeNotes, setAdministrativeNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (teacher) {
      setFullName(teacher.fullName || "");
      setEmployeeNumber(teacher.employeeNumber || "");
      setSpecialization(teacher.specialization || "");
      setSubjects(teacher.subjects || "");
      setWeeklyPeriodCount(teacher.weeklyPeriodCount || 0);
      setEmploymentStartDate(teacher.employmentStartDate ? teacher.employmentStartDate.split("T")[0] : "");
      setEmploymentStatus(teacher.employmentStatus || "ACTIVE");
      setAdministrativeNotes(teacher.administrativeNotes || "");
    } else if (open) {
      setFullName("");
      setEmployeeNumber("");
      setSpecialization("");
      setSubjects("");
      setWeeklyPeriodCount(0);
      setEmploymentStartDate("");
      setEmploymentStatus("ACTIVE");
      setAdministrativeNotes("");
    }
  }, [teacher, open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        employeeNumber: employeeNumber.trim() || null,
        specialization: specialization.trim() || null,
        subjects: subjects.trim() || null,
        weeklyPeriodCount: Number(weeklyPeriodCount) || 0,
        employmentStartDate: employmentStartDate || null,
        employmentStatus,
        administrativeNotes: administrativeNotes.trim() || null,
      };
      const url = teacher ? `/api/teachers/${teacher.id}` : "/api/teachers";
      const method = teacher ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل الحفظ");
      } else {
        toast.success(teacher ? "تم تحديث المعلم" : "تمت إضافة المعلم");
        onSaved();
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{teacher ? "تعديل بيانات المعلم" : "إضافة معلم جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>الاسم الكامل *</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>الرقم الوظيفي</Label>
              <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>التخصص</Label>
              <Input value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>المواد التي يدرسها</Label>
              <Input value={subjects} onChange={(e) => setSubjects(e.target.value)} placeholder="مثال: رياضيات، فيزياء" />
            </div>
            <div className="space-y-2">
              <Label>عدد الحصص الأسبوعية</Label>
              <Input
                type="number"
                min={0}
                value={weeklyPeriodCount}
                onChange={(e) => setWeeklyPeriodCount(Number(e.target.value))}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ بدء العمل</Label>
              <Input type="date" value={employmentStartDate} onChange={(e) => setEmploymentStartDate(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>حالة التوظيف</Label>
              <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">في الخدمة</SelectItem>
                  <SelectItem value="ON_LEAVE">في إجازة</SelectItem>
                  <SelectItem value="INACTIVE">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات إدارية</Label>
            <Textarea
              value={administrativeNotes}
              onChange={(e) => setAdministrativeNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : teacher ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeacherProfileDrawer({
  teacher,
  onClose,
}: {
  teacher: any | null;
  onClose: () => void;
}) {
  if (!teacher) return null;
  return (
    <Sheet open={!!teacher} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">ملف المعلم: {teacher.fullName}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <Tabs defaultValue="basic">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="basic">البيانات</TabsTrigger>
              <TabsTrigger value="work">الأعمال</TabsTrigger>
              <TabsTrigger value="history">السجل</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="الرقم الوظيفي" value={teacher.employeeNumber} />
                <DetailRow label="التخصص" value={teacher.specialization} />
                <DetailRow label="المواد" value={teacher.subjects} />
                <DetailRow label="الحصص الأسبوعية" value={teacher.weeklyPeriodCount} />
                <DetailRow label="تاريخ التعيين" value={formatDate(teacher.employmentStartDate)} />
                <DetailRow
                  label="الحالة"
                  value={
                    <EmploymentBadge
                      status={teacher.employmentStatus}
                      label={EMPLOYMENT_STATUS_LABELS[teacher.employmentStatus]}
                    />
                  }
                />
              </div>
              {teacher.administrativeNotes && (
                <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">ملاحظات:</p>
                  <p>{teacher.administrativeNotes}</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="work" className="space-y-2">
              {teacher.workRecords?.length ? (
                teacher.workRecords.map((wr: any) => (
                  <div
                    key={wr.id}
                    className="flex items-center justify-between p-3 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{wr.assignment?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {wr.assignment?.workType?.name} — استحقاق: {formatDate(wr.assignment?.dueDate)}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-muted">
                      {STATUS_LABELS[wr.status]}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState title="لا توجد أعمال مسجلة" />
              )}
            </TabsContent>
            <TabsContent value="history" className="space-y-2">
              <h4 className="font-medium">الإشغالات كمعلم أصلي</h4>
              {teacher.substitutionsAsOriginal?.length ? (
                teacher.substitutionsAsOriginal.map((s: any) => (
                  <div key={s.id} className="text-sm p-2 border border-border rounded">
                    {formatDate(s.substitutionDate)} — حصة {s.periodNumber} — {s.className}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد</p>
              )}
              <h4 className="font-medium mt-3">الإشغالات كمعلم بديل</h4>
              {teacher.substitutionsAsSubstitute?.length ? (
                teacher.substitutionsAsSubstitute.map((s: any) => (
                  <div key={s.id} className="text-sm p-2 border border-border rounded">
                    {formatDate(s.substitutionDate)} — حصة {s.periodNumber} — {s.className}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد</p>
              )}
              <h4 className="font-medium mt-3">المغادرات</h4>
              {teacher.departures?.length ? (
                teacher.departures.map((d: any) => (
                  <div key={d.id} className="text-sm p-2 border border-border rounded">
                    {formatDate(d.departureDate)} — {d.departureTime} {d.returnTime && `→ ${d.returnTime}`}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="p-2 border border-border rounded">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
