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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge, PriorityBadge } from "@/components/common/StatusBadge";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  Plus,
  Search,
  ClipboardList,
  Eye,
  Edit,
  CheckCircle,
  RefreshCw,
  XCircle,
  Calendar as CalendarIcon,
  Trash2,
} from "lucide-react";

export function AssignmentsView() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [search, statusFilter, page]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/assignments?${params}`);
      const data = await res.json();
      if (res.ok) {
        setAssignments(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || "فشل التحميل");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">التكليفات والأعمال الكتابية</h2>
          <p className="text-sm text-muted-foreground">
            إجمالي التكليفات: {total}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          إنشاء تكليف
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-64">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث بالعنوان..."
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
                <SelectItem value="ACTIVE">نشط</SelectItem>
                <SelectItem value="COMPLETED">مكتمل</SelectItem>
                <SelectItem value="CANCELLED">ملغى</SelectItem>
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
          ) : assignments.length === 0 ? (
            <EmptyState
              title="لا توجد تكليفات"
              description="ابدأ بإنشاء أول تكليف وتعيينه للمعلمين"
              icon={<ClipboardList className="w-6 h-6" />}
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء تكليف
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العنوان</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>تاريخ التكليف</TableHead>
                  <TableHead>تاريخ الاستحقاق</TableHead>
                  <TableHead>الأولوية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>عدد المعلمين</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const overdue =
                    a.assignmentStatus === "ACTIVE" &&
                    new Date(a.dueDate) < new Date();
                  return (
                    <TableRow key={a.id} className={overdue ? "bg-red-50/40" : ""}>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell className="text-xs">{a.workType?.name}</TableCell>
                      <TableCell className="num-ltr text-sm">
                        {formatDate(a.assignedDate)}
                      </TableCell>
                      <TableCell className="num-ltr text-sm">
                        <span className={overdue ? "text-red-600 font-medium" : ""}>
                          {formatDate(a.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <PriorityBadge
                          priority={a.priority}
                          label={PRIORITY_LABELS[a.priority]}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={a.assignmentStatus}
                          label={STATUS_LABELS[a.assignmentStatus] || a.assignmentStatus}
                        />
                      </TableCell>
                      <TableCell className="num-ltr">
                        {a.workRecords?.length || 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewing(a)}
                            title="عرض"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditing(a);
                              setShowForm(true);
                            }}
                            title="تعديل"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {a.assignmentStatus === "ACTIVE" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCancelTarget(a)}
                              className="text-destructive"
                              title="إلغاء التكليف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
            <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
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

      <AssignmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        assignment={editing}
        onSaved={() => {
          setShowForm(false);
          void load();
        }}
      />

      <AssignmentDetailDrawer assignment={viewing} onClose={() => setViewing(null)} onChanged={load} />

      {/* Cancel (soft-delete) assignment confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء التكليف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إلغاء التكليف &quot;{cancelTarget?.title}&quot;. سيتم الاحتفاظ بالسجلات التاريخية
              لكل المعلمين، لكن لن يظهر التكليف ضمن الأعمال النشطة. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!cancelTarget) return;
                try {
                  const res = await fetch(`/api/assignments/${cancelTarget.id}`, { method: "DELETE" });
                  if (res.ok) {
                    toast.success("تم إلغاء التكليف");
                    setCancelTarget(null);
                    void load();
                  } else {
                    const data = await res.json();
                    toast.error(data.error || "فشل الإلغاء");
                  }
                } catch {
                  toast.error("خطأ في الشبكة");
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssignmentFormDialog({
  open,
  onOpenChange,
  assignment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignment: any | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workTypeId, setWorkTypeId] = useState("");
  const [assignedDate, setAssignedDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [schoolPeriodId, setSchoolPeriodId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [adminInstructions, setAdminInstructions] = useState("");
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [schoolPeriods, setSchoolPeriods] = useState<any[]>([]);
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
    if (schoolYearId) {
      fetch("/api/school-years")
        .then((r) => r.json())
        .then((data) => {
          const year = data.find((y: any) => y.id === schoolYearId);
          setSchoolPeriods(year?.terms || []);
        })
        .catch(() => setSchoolPeriods([]));
    }
  }, [schoolYearId]);

  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title || "");
      setDescription(assignment.description || "");
      setWorkTypeId(assignment.workTypeId || "");
      setAssignedDate(assignment.assignedDate?.split("T")[0] || "");
      setDueDate(assignment.dueDate?.split("T")[0] || "");
      setSchoolYearId(assignment.schoolYearId || "");
      setSchoolPeriodId(assignment.schoolPeriodId || "");
      setPriority(assignment.priority || "NORMAL");
      setAdminInstructions(assignment.adminInstructions || "");
      setSelectedTeachers(assignment.workRecords?.map((wr: any) => wr.teacherId) || []);
    } else if (open) {
      const today = new Date().toISOString().split("T")[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      setTitle("");
      setDescription("");
      setWorkTypeId("");
      setAssignedDate(today);
      setDueDate(nextWeek);
      const activeYear = schoolYears.find((y) => y.isActive);
      setSchoolYearId(activeYear?.id || schoolYears[0]?.id || "");
      setSchoolPeriodId("");
      setPriority("NORMAL");
      setAdminInstructions("");
      setSelectedTeachers([]);
    }
  }, [assignment, open]);

  function toggleTeacher(id: string) {
    setSelectedTeachers((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function toggleSelectAllTeachers() {
    // If all are already selected → deselect all; otherwise select all
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
    if (!title.trim() || !workTypeId || !assignedDate || !dueDate || !schoolYearId) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    if (selectedTeachers.length === 0) {
      toast.error("اختر معلمًا واحدًا على الأقل");
      return;
    }
    if (new Date(dueDate) < new Date(assignedDate)) {
      toast.error("تاريخ الاستحقاق يجب أن يكون بعد تاريخ التكليف");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        workTypeId,
        assignedDate,
        dueDate,
        schoolYearId,
        schoolPeriodId: schoolPeriodId || null,
        priority,
        adminInstructions: adminInstructions.trim() || null,
        teacherIds: selectedTeachers,
      };
      const url = assignment ? `/api/assignments/${assignment.id}` : "/api/assignments";
      const method = assignment ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل الحفظ");
      } else {
        toast.success(assignment ? "تم التحديث" : "تم إنشاء التكليف");
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
          <DialogTitle>{assignment ? "تعديل التكليف" : "إنشاء تكليف جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>عنوان التكليف *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
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
              <Label>تاريخ التكليف *</Label>
              <Input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} dir="ltr" required />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الاستحقاق *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} dir="ltr" required />
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
                  <SelectValue placeholder="اختر..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolPeriods.map((p) => (
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
            <Textarea value={adminInstructions} onChange={(e) => setAdminInstructions(e.target.value)} rows={3} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "جاري الحفظ..." : assignment ? "حفظ التعديلات" : "إنشاء التكليف"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentDetailDrawer({
  assignment,
  onClose,
  onChanged,
}: {
  assignment: any | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!assignment) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/assignments/${assignment.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignment]);

  return (
    <Sheet open={!!assignment} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{assignment?.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">النوع</p>
                  <p className="font-medium">{data.workType?.name}</p>
                </div>
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">العام الدراسي</p>
                  <p className="font-medium">{data.schoolYear?.name}</p>
                </div>
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">تاريخ التكليف</p>
                  <p className="font-medium num-ltr">{formatDate(data.assignedDate)}</p>
                </div>
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground">تاريخ الاستحقاق</p>
                  <p className="font-medium num-ltr">{formatDate(data.dueDate)}</p>
                </div>
              </div>
              {data.description && (
                <div className="p-3 border border-border rounded-lg text-sm">
                  <p className="font-medium mb-1">الوصف</p>
                  <p>{data.description}</p>
                </div>
              )}
              {data.adminInstructions && (
                <div className="p-3 border border-border rounded-lg bg-muted/30 text-sm">
                  <p className="font-medium mb-1">التعليمات الإدارية</p>
                  <p>{data.adminInstructions}</p>
                </div>
              )}
              <div>
                <h4 className="font-semibold mb-2">سجلات المعلمين</h4>
                <div className="space-y-2">
                  {data.workRecords?.map((wr: any) => (
                    <WorkRecordRow
                      key={wr.id}
                      record={wr}
                      onChanged={() => {
                        // Refetch the current assignment
                        fetch(`/api/assignments/${assignment.id}`)
                          .then((r) => r.json())
                          .then(setData);
                        onChanged();
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="فشل تحميل البيانات" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function WorkRecordRow({ record, onChanged }: { record: any; onChanged: () => void }) {
  const [openReview, setOpenReview] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewResult, setReviewResult] = useState<"APPROVED" | "NEEDS_REVISION" | "REJECTED">("NEEDS_REVISION");
  const [updating, setUpdating] = useState(false);

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      const update: any = { status };
      if (status === "IN_PROGRESS" || status === "SUBMITTED") {
        update.submittedAt = status === "SUBMITTED" ? new Date().toISOString() : null;
      }
      if (status === "COMPLETED") {
        update.completionDate = new Date().toISOString();
      }
      const res = await fetch(`/api/work-records/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        toast.success("تم التحديث");
        onChanged();
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل");
      }
    } finally {
      setUpdating(false);
    }
  }

  async function submitReview() {
    setUpdating(true);
    try {
      const res = await fetch(`/api/work-records/${record.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewResult, reviewNotes: reviewNotes.trim() || null }),
      });
      if (res.ok) {
        toast.success("تم تسجيل المراجعة");
        setOpenReview(false);
        setReviewNotes("");
        onChanged();
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل");
      }
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{record.teacher?.fullName}</p>
          <p className="text-xs text-muted-foreground">
            آخر تحديث: {formatDate(record.updatedAt)}
          </p>
        </div>
        <StatusBadge status={record.status} label={STATUS_LABELS[record.status]} />
      </div>

      <div className="flex flex-wrap gap-1">
        {record.status !== "IN_PROGRESS" && (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => updateStatus("IN_PROGRESS")}>
            <Edit className="w-3 h-3 ml-1" />
            بدء العمل
          </Button>
        )}
        {record.status !== "SUBMITTED" && (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => updateStatus("SUBMITTED")}>
            <CheckCircle className="w-3 h-3 ml-1" />
            تسليم
          </Button>
        )}
        {record.status !== "COMPLETED" && (
          <Button size="sm" variant="outline" disabled={updating} onClick={() => updateStatus("COMPLETED")}>
            <CheckCircle className="w-3 h-3 ml-1" />
            إكمال
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={updating} onClick={() => setOpenReview(true)}>
          <RefreshCw className="w-3 h-3 ml-1" />
          مراجعة
        </Button>
        {record.status !== "REJECTED" && (
          <Button
            size="sm"
            variant="outline"
            disabled={updating}
            className="text-destructive"
            onClick={() => updateStatus("REJECTED")}
          >
            <XCircle className="w-3 h-3 ml-1" />
            رفض
          </Button>
        )}
      </div>

      {(record.administrativeNotes || record.revisionNotes) && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
          {record.administrativeNotes && <p>ملاحظات: {record.administrativeNotes}</p>}
          {record.revisionNotes && <p className="text-orange-700">تعديلات مطلوبة: {record.revisionNotes}</p>}
        </div>
      )}

      {record.reviews?.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            سجل المراجعات ({record.reviews.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {record.reviews.map((r: any) => (
              <li key={r.id} className="p-2 border border-border rounded">
                <div className="flex justify-between">
                  <span className="font-medium">{r.reviewResult}</span>
                  <span className="text-muted-foreground num-ltr">
                    {formatDate(r.reviewedAt)}
                  </span>
                </div>
                {r.reviewNotes && <p className="mt-1">{r.reviewNotes}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {openReview && (
        <div className="mt-2 p-2 border border-border rounded space-y-2 bg-muted/20">
          <Select value={reviewResult} onValueChange={(v) => setReviewResult(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APPROVED">اعتماد</SelectItem>
              <SelectItem value="NEEDS_REVISION">يحتاج تعديل</SelectItem>
              <SelectItem value="REJECTED">رفض</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="ملاحظات المراجعة..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={updating} onClick={submitReview}>
              تأكيد المراجعة
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOpenReview(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
