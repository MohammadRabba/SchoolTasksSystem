"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { FREQUENCY_LABELS } from "@/lib/labels";
import { toast } from "sonner";
import { Plus, ListChecks, Edit, Trash2 } from "lucide-react";

export function WorkTypesView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/work-types");
      if (res.ok) {
        setItems(await res.json());
      } else {
        toast.error("فشل التحميل");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا النوع؟ سيتم تعطيله فقط.")) return;
    try {
      const res = await fetch(`/api/work-types/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم تعطيل النوع");
        void load();
      }
    } catch {
      toast.error("خطأ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">أنواع الأعمال الكتابية</h2>
          <p className="text-sm text-muted-foreground">
            إدارة الأنواع القابلة لإعادة الاستخدام في التكليفات
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة نوع
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
              title="لا توجد أنواع أعمال"
              description="ابدأ بإضافة نوع عمل جديد (مثل: تحضير الدروس، دفتر العلامات)"
              icon={<ListChecks className="w-6 h-6" />}
              action={
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة نوع
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الوصف</TableHead>
                  <TableHead>التكرار الافتراضي</TableHead>
                  <TableHead>أيام الإكمال الافتراضية</TableHead>
                  <TableHead>يتطلب اعتماد</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((w) => (
                  <TableRow key={w.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-xs">{w.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {FREQUENCY_LABELS[w.defaultFrequency] || w.defaultFrequency}
                      </Badge>
                    </TableCell>
                    <TableCell className="num-ltr">{w.defaultCompletionDays || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={w.requiresApproval ? "default" : "secondary"}>
                        {w.requiresApproval ? "نعم" : "لا"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.isActive ? "default" : "secondary"}>
                        {w.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(w);
                            setShowForm(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(w.id)}
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

      <WorkTypeFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        workType={editing}
        onSaved={() => {
          setShowForm(false);
          void load();
        }}
      />
    </div>
  );
}

function WorkTypeFormDialog({
  open,
  onOpenChange,
  workType,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workType: any | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultFrequency, setDefaultFrequency] = useState("WEEKLY");
  const [defaultCompletionDays, setDefaultCompletionDays] = useState<number | "">("");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workType) {
      setName(workType.name || "");
      setDescription(workType.description || "");
      setDefaultFrequency(workType.defaultFrequency || "WEEKLY");
      setDefaultCompletionDays(workType.defaultCompletionDays || "");
      setRequiresApproval(workType.requiresApproval ?? true);
      setIsActive(workType.isActive ?? true);
    } else if (open) {
      setName("");
      setDescription("");
      setDefaultFrequency("WEEKLY");
      setDefaultCompletionDays("");
      setRequiresApproval(true);
      setIsActive(true);
    }
  }, [workType, open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        defaultFrequency,
        defaultCompletionDays: defaultCompletionDays === "" ? null : Number(defaultCompletionDays),
        requiresApproval,
        isActive,
      };
      const url = workType ? `/api/work-types/${workType.id}` : "/api/work-types";
      const method = workType ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل الحفظ");
      } else {
        toast.success(workType ? "تم التحديث" : "تمت الإضافة");
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
          <DialogTitle>{workType ? "تعديل نوع عمل" : "إضافة نوع عمل جديد"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>الاسم *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>التكرار الافتراضي</Label>
              <Select value={defaultFrequency} onValueChange={setDefaultFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">يومي</SelectItem>
                  <SelectItem value="WEEKLY">أسبوعي</SelectItem>
                  <SelectItem value="MONTHLY">شهري</SelectItem>
                  <SelectItem value="TERM_BASED">فصلي</SelectItem>
                  <SelectItem value="ANNUAL">سنوي</SelectItem>
                  <SelectItem value="ONE_TIME">مرة واحدة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>أيام الإكمال الافتراضية</Label>
              <Input
                type="number"
                min={1}
                value={defaultCompletionDays}
                onChange={(e) => setDefaultCompletionDays(e.target.value === "" ? "" : Number(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <p className="font-medium">يتطلب اعتماد</p>
              <p className="text-xs text-muted-foreground">عند الإكمال يجب أن يعتمده المدير</p>
            </div>
            <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
          </div>
          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <p className="font-medium">نشط</p>
              <p className="text-xs text-muted-foreground">يمكن استخدام هذا النوع في التكليفات الجديدة</p>
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
