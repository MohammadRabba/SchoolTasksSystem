"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, Menu, Bell, User, Settings, Search, Languages, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { useLangStore } from "@/store/useLangStore";
import { NAV_ITEMS } from "@/lib/labels";
import { useEffect, useState } from "react";

export function SchoolHeader() {
  const { data: session } = useSession();
  const setView = useAppStore((s) => s.setView);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const view = useAppStore((s) => s.view);
  const lang = useLangStore((s) => s.lang);
  const toggleLang = useLangStore((s) => s.toggle);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    fetch("/api/notifications?count=true")
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.unread || 0))
      .catch(() => {});
  }, [view]);

  async function openNotifPanel() {
    setNotifOpen(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      const d = await res.json();
      setNotifications(d.notifications || []);
      setUnreadCount(d.unread || 0);
    } catch {}
  }

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function triggerGlobalSearch() {
    // Dispatch a custom event the GlobalSearchModal listens for (fallback to keyboard shortcut)
    const evt = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(evt);
  }

  const currentLabel = NAV_ITEMS.find((n) => n.key === view)?.label || "";

  return (
    <header className="sticky top-0 z-30 bg-background border-b border-border">
      <div className="flex items-center gap-3 px-4 md:px-6 h-16">
        {/* Mobile menu */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <SheetTitle className="sr-only">القائمة الرئيسية</SheetTitle>
            <MobileNavContent />
          </SheetContent>
        </Sheet>

        {/* Page title */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-foreground truncate">
            {currentLabel}
          </h1>
        </div>

        {/* Global Search trigger */}
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerGlobalSearch}
          className="gap-2 hidden md:flex"
          title="بحث شامل (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">بحث</span>
          <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded">⌘K</kbd>
        </Button>

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLang}
          title={lang === "ar" ? "Switch to English" : "التبديل للعربية"}
        >
          <Languages className="w-5 h-5" />
        </Button>

        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={openNotifPanel}
              className="relative"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -left-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="p-2 flex items-center justify-between border-b border-border">
              <span className="font-medium text-sm">التنبيهات</span>
              {unreadCount > 0 && (
                <Button size="sm" variant="ghost" onClick={markAllRead} className="h-7 text-xs">
                  <RefreshCw className="w-3 h-3 ml-1" />
                  تعليم الكل كمقروء
                </Button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  لا توجد تنبيهات
                </div>
              ) : (
                notifications.map((n) => (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex-col items-start gap-1 p-3"
                    onClick={() => setView("calendar")}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium text-sm">{n.title}</span>
                      {!n.isRead && (
                        <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 num-ltr">
                      {new Date(n.createdAt).toLocaleString("ar-EG")}
                    </p>
                  </DropdownMenuItem>
                ))
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setView("pending")} className="text-center justify-center">
              فتح صفحة الإجراءات المعلّقة
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <User className="w-4 h-4" />
              <span className="hidden md:inline text-sm font-medium">
                {session?.user?.name || "المدير"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled className="flex-col items-start gap-1">
              <span className="font-medium">{session?.user?.name}</span>
              <span className="text-xs text-muted-foreground">
                {session?.user?.email}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setView("settings")}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              الإعدادات
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setView("backup-restore")}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              النسخ الاحتياطي
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="gap-2 text-destructive"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function MobileNavContent() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="p-5 border-b border-sidebar-border">
        <p className="text-sm font-bold text-sidebar-foreground">
          مدرسة ذكور المستقبل الصالح
        </p>
        <p className="text-xs text-muted-foreground">الأساسية العليا</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key);
                setSidebarOpen(false);
              }}
              className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-sidebar-accent"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
