"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import { Plus, School, Edit, Trash2 } from "lucide-react";

export function ClassSectionsView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/class-sections");
      if (res.ok) setItems(await res.json());
    } catch {
      toast.error("خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/class-sections/${deleteTarget.id}`, { method: "DELETE" });
      const d = await res.json();
      if (res.ok) {
        toast.success("تم الحذف");
        setDeleteTarget(null);
        void load();
      } else {
        toast.error(d.error || "فشل");
      }
    } catch {
      toast.error("خطأ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">الصفوف والشعب</h2>
          <p className="text-sm text-muted-foreground">
            إدارة السجلات العامة للصفوف والشعب — مرتبطة بالمعلمين
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة صف/شعبة
        </Button>
      </div>

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
              title="لا توجد صفوف مسجلة"
              description="أضف الصفوف والشعب لربطها بالمعلمين والفلترة بها"
              icon={<School className="w-6 h-6" />}
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصف</TableHead>
                  <TableHead>الشعبة</TableHead>
                  <TableHead>ملاحظات</TableHead>
                  <TableHead>عدد المعلمين</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((cs) => (
                  <TableRow key={cs.id}>
                    <TableCell className="font-medium">{cs.className}</TableCell>
                    <TableCell>{cs.sectionName}</TableCell>
                    <TableCell className="text-xs">{cs.notes || "—"}</TableCell>
                    <TableCell className="num-ltr">{cs._count?.teachers || 0}</TableCell>
                    <TableCell>
                      <Badge variant={cs.isActive ? "default" : "secondary"}>
                        {cs.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(cs);
                            setShowForm(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(cs)}
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

      <ClassSectionFormDialog
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
              سيتم حذف الصف &quot;{deleteTarget?.className} ({deleteTarget?.sectionName})&quot;.
              لا يمكن الحذف إذا كان مرتبطًا بمعلمين.
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

function ClassSectionFormDialog({
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
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setClassName(editing.className || "");
      setSectionName(editing.sectionName || "");
      setNotes(editing.notes || "");
      setIsActive(editing.isActive ?? true);
    } else if (open) {
      setClassName("");
      setSectionName("");
      setNotes("");
      setIsActive(true);
    }
  }, [editing, open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!className.trim() || !sectionName.trim()) {
      toast.error("الصف والشعبة مطلوبان");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        className: className.trim(),
        sectionName: sectionName.trim(),
        notes: notes.trim() || null,
        isActive,
      };
      const url = editing ? `/api/class-sections/${editing.id}` : "/api/class-sections";
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
        toast.success(editing ? "تم التحديث" : "تمت الإضافة");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "تعديل صف/شعبة" : "إضافة صف/شعبة"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>الصف *</Label>
              <Input
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="مثال: السادس"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>الشعبة *</Label>
              <Input
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="مثال: أ"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ملاحظات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <p className="font-medium">نشط</p>
              <p className="text-xs text-muted-foreground">يمكن استخدام هذا الصف عند المعلمين والإشغالات</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
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
