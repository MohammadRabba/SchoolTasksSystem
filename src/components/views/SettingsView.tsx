"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Save, Plus, Calendar } from "lucide-react";

export function SettingsView() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">إعدادات المدرسة</h2>
        <p className="text-sm text-muted-foreground">
          تكوين اسم المدرسة، الإعدادات الافتراضية، والأعوام الدراسية
        </p>
      </div>
      <SettingsForm />
      <SchoolYearsManager />
    </div>
  );
}

function SettingsForm() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => toast.error("فشل تحميل الإعدادات"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("تم حفظ الإعدادات");
        setSettings(await res.json());
      } else {
        toast.error("فشل الحفظ");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">بيانات المدرسة العامة</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>اسم المدرسة (عربي)</Label>
              <Input
                value={settings.schoolNameAr || ""}
                onChange={(e) => setSettings({ ...settings, schoolNameAr: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>اسم المدرسة (إنجليزي)</Label>
              <Input
                value={settings.schoolNameEn || ""}
                onChange={(e) => setSettings({ ...settings, schoolNameEn: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>المنطقة الزمنية</Label>
              <Input
                value={settings.timezone || ""}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>أيام العمل</Label>
              <Input
                value={settings.workingDays || ""}
                onChange={(e) => setSettings({ ...settings, workingDays: e.target.value })}
                placeholder="SUN,MON,TUE,WED,THU"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>عدد أيام الموعد النهائي الافتراضي</Label>
              <Input
                type="number"
                min={1}
                value={settings.defaultDeadlineDays ?? 7}
                onChange={(e) =>
                  setSettings({ ...settings, defaultDeadlineDays: Number(e.target.value) })
                }
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>عتبة التنبيهات (أيام)</Label>
              <Input
                type="number"
                min={1}
                value={settings.notificationThresholdDays ?? 3}
                onChange={(e) =>
                  setSettings({ ...settings, notificationThresholdDays: Number(e.target.value) })
                }
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>حد الإشغالات الأقصى للمعلم</Label>
              <Input
                type="number"
                min={1}
                value={settings.maxSubstitutionPeriods ?? 10}
                onChange={(e) =>
                  setSettings({ ...settings, maxSubstitutionPeriods: Number(e.target.value) })
                }
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>بداية أسبوع التقرير</Label>
              <Select
                value={settings.reportWeekStart || "SUNDAY"}
                onValueChange={(v) => setSettings({ ...settings, reportWeekStart: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUNDAY">الأحد</SelectItem>
                  <SelectItem value="MONDAY">الاثنين</SelectItem>
                  <SelectItem value="SATURDAY">السبت</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>العام الدراسي الحالي</Label>
              <Input
                value={settings.academicYearName || ""}
                onChange={(e) => setSettings({ ...settings, academicYearName: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 ml-2" />
            {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SchoolYearsManager() {
  const [years, setYears] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/school-years");
    if (res.ok) setYears(await res.json());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      toast.error("يرجى تعبئة جميع الحقول");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/school-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, startDate, endDate, isActive }),
      });
      if (res.ok) {
        toast.success("تمت الإضافة");
        setName("");
        setStartDate("");
        setEndDate("");
        setIsActive(false);
        void load();
      } else {
        const data = await res.json();
        toast.error(data.error || "فشل");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">الأعوام الدراسية</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {years.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البداية</TableHead>
                <TableHead>النهاية</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.id}>
                  <TableCell className="font-medium">{y.name}</TableCell>
                  <TableCell className="num-ltr text-sm">
                    {new Date(y.startDate).toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell className="num-ltr text-sm">
                    {new Date(y.endDate).toLocaleDateString("ar-EG")}
                  </TableCell>
                  <TableCell>
                    {y.isActive && (
                      <span className="text-xs font-medium text-green-600 px-2 py-1 bg-green-50 rounded">
                        نشط
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="border-t border-border pt-4">
          <p className="font-medium mb-3">إضافة عام دراسي جديد</p>
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2026/2027" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ البداية</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ النهاية</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>تفعيل</Label>
              <div className="flex items-center h-10">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <span className="text-sm text-muted-foreground mr-2">
                  {isActive ? "نشط" : "غير نشط"}
                </span>
              </div>
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={saving}>
                <Plus className="w-4 h-4 ml-2" />
                {saving ? "جاري الإضافة..." : "إضافة"}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
