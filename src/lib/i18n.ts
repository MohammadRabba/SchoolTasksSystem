// ============================================================
// Bilingual dictionary (Arabic / English)
// ============================================================
// Used by the language toggle feature. To add a new string:
//   1. Add it to `translations` with both ar + en keys
//   2. Use t("key") in components instead of hardcoded text
//
// Most existing components still use hardcoded Arabic text — only the
// most user-facing strings (Header nav, common actions) are bilingual.
// This is intentionally a soft migration: the existing Arabic UI keeps
// working as-is, and bilingual strings are added where they matter most.

export type Language = "ar" | "en";

export const translations: Record<string, { ar: string; en: string }> = {
  // Header / nav
  "app.name": { ar: "نظام إدارة المدرسة", en: "School Admin System" },
  "app.schoolName": {
    ar: "مدرسة ذكور المستقبل الصالح الأساسية العليا",
    en: "Al-Mustaqbal Al-Saleh Upper Basic Boys School",
  },

  // Nav items
  "nav.dashboard": { ar: "لوحة التحكم", en: "Dashboard" },
  "nav.teachers": { ar: "إدارة المعلمين", en: "Teachers" },
  "nav.workTypes": { ar: "أنواع الأعمال الكتابية", en: "Work Types" },
  "nav.assignments": { ar: "التكليفات والأعمال الكتابية", en: "Assignments" },
  "nav.recurring": { ar: "التكليفات التلقائية", en: "Recurring Assignments" },
  "nav.substitutions": { ar: "حصص الإشغالات", en: "Substitutions" },
  "nav.departures": { ar: "تقارير المغادرة", en: "Departures" },
  "nav.pending": { ar: "إجراءات معلّقة", en: "Pending Actions" },
  "nav.calendar": { ar: "التقويم والتنبيهات", en: "Calendar & Alerts" },
  "nav.reports": { ar: "التقارير", en: "Reports" },
  "nav.analytics": { ar: "التحليلات", en: "Analytics" },
  "nav.audit": { ar: "سجل التدقيق", en: "Audit Log" },
  "nav.settings": { ar: "إعدادات المدرسة", en: "Settings" },
  "nav.classes": { ar: "الصفوف والشعب", en: "Classes & Sections" },
  "nav.backup": { ar: "النسخ الاحتياطي", en: "Backup & Restore" },

  // Common actions
  "action.add": { ar: "إضافة", en: "Add" },
  "action.edit": { ar: "تعديل", en: "Edit" },
  "action.delete": { ar: "حذف", en: "Delete" },
  "action.cancel": { ar: "إلغاء", en: "Cancel" },
  "action.save": { ar: "حفظ", en: "Save" },
  "action.search": { ar: "بحث", en: "Search" },
  "action.view": { ar: "عرض", en: "View" },
  "action.approve": { ar: "اعتماد", en: "Approve" },
  "action.reject": { ar: "رفض", en: "Reject" },
  "action.archive": { ar: "أرشفة", en: "Archive" },
  "action.restore": { ar: "استعادة", en: "Restore" },
  "action.export": { ar: "تصدير", en: "Export" },
  "action.print": { ar: "طباعة", en: "Print" },
  "action.logout": { ar: "تسجيل الخروج", en: "Logout" },
  "action.confirm": { ar: "تأكيد", en: "Confirm" },

  // Notifications
  "notif.title": { ar: "التنبيهات", en: "Notifications" },
  "notif.markRead": { ar: "تعليم كمقروء", en: "Mark as read" },
  "notif.markAllRead": { ar: "تعليم الكل كمقروء", en: "Mark all as read" },
  "notif.empty": { ar: "لا توجد تنبيهات", en: "No notifications" },

  // Global search
  "search.placeholder": {
    ar: "ابحث في كل النظام... (Ctrl+K)",
    en: "Search everything... (Ctrl+K)",
  },
  "search.empty": {
    ar: "لا توجد نتائج مطابقة",
    en: "No matching results",
  },

  // Session
  "session.expiringSoon": {
    ar: "ستنتهي جلستك خلال {minutes} دقيقة",
    en: "Your session expires in {minutes} minutes",
  },
  "session.extend": { ar: "تمديد الجلسة", en: "Extend session" },
  "session.expired": {
    ar: "انتهت جلستك. يرجى تسجيل الدخول من جديد.",
    en: "Your session has expired. Please sign in again.",
  },

  // Login throttle
  "auth.throttled": {
    ar: "تم قفل الدخول بعد عدة محاولات فاشلة. حاول بعد {minutes} دقيقة.",
    en: "Login locked after multiple failed attempts. Try again in {minutes} minutes.",
  },
  "auth.invalid": { ar: "البيانات غير صحيحة", en: "Invalid credentials" },
};

export function getT(lang: Language) {
  return (key: string, vars?: Record<string, string | number>): string => {
    const entry = translations[key];
    if (!entry) return key;
    let s = entry[lang] || entry.ar;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(`{${k}}`, String(v));
      }
    }
    return s;
  };
}

export const LANG_STORAGE_KEY = "school-admin-lang";
