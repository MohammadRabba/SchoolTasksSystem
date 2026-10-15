import { AppView } from "@/store/useAppStore";

export const NAV_ITEMS: { key: AppView; label: string; icon: string }[] = [
  { key: "dashboard", label: "لوحة التحكم", icon: "LayoutDashboard" },
  { key: "pending", label: "إجراءات معلّقة", icon: "AlertCircle" },
  { key: "teachers", label: "إدارة المعلمين", icon: "Users" },
  { key: "work-types", label: "أنواع الأعمال الكتابية", icon: "ListChecks" },
  { key: "assignments", label: "التكليفات والأعمال الكتابية", icon: "ClipboardList" },
  { key: "recurring-assignments", label: "التكليفات التلقائية", icon: "Repeat" },
  { key: "substitutions", label: "حصص الإشغالات", icon: "Calendar" },
  { key: "departures", label: "تقارير المغادرة", icon: "DoorOpen" },
  { key: "calendar", label: "التقويم الشهري والتنبيهات", icon: "BellRing" },
  { key: "reports", label: "التقارير", icon: "FileText" },
  { key: "analytics", label: "التحليلات", icon: "BarChart3" },
  { key: "audit", label: "سجل التدقيق", icon: "History" },
  { key: "class-sections", label: "الصفوف والشعب", icon: "School" },
  { key: "backup-restore", label: "النسخ الاحتياطي", icon: "DatabaseBackup" },
  { key: "settings", label: "إعدادات المدرسة", icon: "Settings" },
];

export const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "لم يبدأ",
  IN_PROGRESS: "قيد التنفيذ",
  SUBMITTED: "مُسلَّم",
  NEEDS_REVISION: "يحتاج تعديل",
  COMPLETED: "مكتمل",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "منخفضة",
  NORMAL: "عادية",
  HIGH: "عالية",
  URGENT: "عاجلة",
};

export const DEPARTURE_TYPE_LABELS: Record<string, string> = {
  PERSONAL: "شخصي",
  MEDICAL: "طبي",
  OFFICIAL: "رسمي",
  EMERGENCY: "طارئ",
  OTHER: "أخرى",
};

export const PERMISSION_TYPE_LABELS: Record<string, string> = {
  PRE_APPROVED: "موافق عليه مسبقًا",
  EMERGENCY: "طارئ",
};

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "موافق عليه",
  REJECTED: "مرفوض",
  COMPLETED: "مكتمل",
};

export const SUBSTITUTION_REASON_LABELS: Record<string, string> = {
  ABSENCE: "غياب المعلم",
  DEPARTURE_LEAVE: "مغادرة/إجازة",
  ADMIN_ASSIGNMENT: "تكليف إداري",
  EMERGENCY: "طارئ",
  OTHER: "أخرى",
};

export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "في الخدمة",
  ON_LEAVE: "في إجازة",
  INACTIVE: "غير نشط",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "يومي",
  WEEKLY: "أسبوعي",
  MONTHLY: "شهري",
  TERM_BASED: "فصلي",
  ANNUAL: "سنوي",
  ONE_TIME: "مرة واحدة",
};
