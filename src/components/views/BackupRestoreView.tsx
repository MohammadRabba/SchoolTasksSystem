"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { DatabaseBackup, Download, Upload, Loader2 } from "lucide-react";

export function BackupRestoreView() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importTarget, setImportTarget] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/backup/export");
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "فشل التصدير");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `school-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم تنزيل النسخة الاحتياطية");
    } catch {
      toast.error("خطأ");
    } finally {
      setExporting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportTarget(f);
    setConfirmOpen(true);
  }

  async function handleImport() {
    if (!importTarget) return;
    setImporting(true);
    try {
      const text = await importTarget.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم استيراد ${data.totalRecords} سجل`);
      } else {
        toast.error(data.error || "فشل الاستيراد");
      }
    } catch (e) {
      toast.error("ملف غير صالح");
    } finally {
      setImporting(false);
      setConfirmOpen(false);
      setImportTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">النسخ الاحتياطي والاستعادة</h2>
        <p className="text-sm text-muted-foreground">
          تنزيل نسخة احتياطية كاملة من قاعدة البيانات / استعادتها
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4" />
              تنزيل نسخة احتياطية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ينزّل ملف JSON يحتوي على جميع بيانات النظام (المعلمون، التكليفات، الإشغالات،
              المغادرات، سجل التدقيق، الإعدادات...). احتفظ به في مكان آمن.
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
              <li>المعلمون + أرقامهم الوظيفية + حالتهم</li>
              <li>التكليفات + سجلات العمل + المراجعات</li>
              <li>الإشغالات + المغادرات + الإعدادات</li>
              <li>لا تشمل: كلمات المرور، محاولات الدخول</li>
            </ul>
            <Button onClick={handleExport} disabled={exporting} className="w-full">
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 ml-2" />
                  تنزيل النسخة الاحتياطية
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Import card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4" />
              استعادة من نسخة احتياطية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              ارفع ملف JSON تم تنزيله سابقًا. تُضاف السجلات الجديدة فقط (لا يُكتب فوق الموجود).
              للاستعادة الكاملة: استخدم db:reset:safe أولاً ثم استورد هنا.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleFileSelect}
                className="hidden"
                id="backup-file-input"
              />
              <label htmlFor="backup-file-input" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">اختر ملف JSON</p>
                <p className="text-xs text-muted-foreground">حتى 50MB</p>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3 text-sm">
            <DatabaseBackup className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">أفضل ممارسات النسخ الاحتياطي</p>
              <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                <li>أنشئ نسخة احتياطية أسبوعيًا على الأقل، وقبل أي تغيير كبير</li>
                <li>احتفظ بأحدث 4 نسخ على الأقل</li>
                <li>اختبر الاستعادة على قاعدة بيانات تجريبية قبل الاعتماد عليها في الإنتاج</li>
                <li>للإنتاج على Neon: استخدم pg_dump كنسخ احتياطي مؤتمت (cron job يومي)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الاستيراد</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم استيراد البيانات من الملف &quot;{importTarget?.name}&quot;.
              تُضاف السجلات الجديدة فقط (لا يُكتب فوق الموجود). متابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} disabled={importing}>
              {importing ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
