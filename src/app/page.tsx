"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { SchoolHeader } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { DashboardView } from "@/components/views/DashboardView";
import { TeachersView } from "@/components/views/TeachersView";
import { TeacherDetailView } from "@/components/views/TeacherDetailView";
import { WorkTypesView } from "@/components/views/WorkTypesView";
import { AssignmentsView } from "@/components/views/AssignmentsView";
import { RecurringAssignmentsView } from "@/components/views/RecurringAssignmentsView";
import { SubstitutionsView } from "@/components/views/SubstitutionsView";
import { DeparturesView } from "@/components/views/DeparturesView";
import { PendingActionsView } from "@/components/views/PendingActionsView";
import { CalendarView } from "@/components/views/CalendarView";
import { ReportsView } from "@/components/views/ReportsView";
import { AnalyticsView } from "@/components/views/AnalyticsView";
import { AuditView } from "@/components/views/AuditView";
import { SettingsView } from "@/components/views/SettingsView";
import { ClassSectionsView } from "@/components/views/ClassSectionsView";
import { BackupRestoreView } from "@/components/views/BackupRestoreView";
import { LoginForm } from "@/components/auth/LoginForm";
import { SetupForm } from "@/components/auth/SetupForm";
import { GlobalSearchModal } from "@/components/common/GlobalSearchModal";
import { SessionWarning } from "@/components/common/SessionWarning";
import { useAppStore } from "@/store/useAppStore";
import { Toaster } from "@/components/ui/sonner";
import { Loader2, GraduationCap } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const view = useAppStore((s) => s.view);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetupRequired(false);
      return;
    }
    let cancelled = false;
    fetch("/api/setup")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSetupRequired(d.setupRequired);
      })
      .catch(() => {
        if (!cancelled) setSetupRequired(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, status]);

  if (status === "loading" || setupRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <GraduationCap className="w-12 h-12 mx-auto text-primary" />
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري التحميل...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return setupRequired ? <SetupForm /> : <LoginForm />;
  }

  return <AppShell />;
}

function AppShell() {
  const view = useAppStore((s) => s.view);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <MobileNav />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <SchoolHeader />
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">
          {view === "dashboard" && <DashboardView />}
          {view === "teachers" && <TeachersView />}
          {view === "teacher-detail" && <TeacherDetailView />}
          {view === "work-types" && <WorkTypesView />}
          {view === "assignments" && <AssignmentsView />}
          {view === "recurring-assignments" && <RecurringAssignmentsView />}
          {view === "substitutions" && <SubstitutionsView />}
          {view === "departures" && <DeparturesView />}
          {view === "pending" && <PendingActionsView />}
          {view === "calendar" && <CalendarView />}
          {view === "reports" && <ReportsView />}
          {view === "analytics" && <AnalyticsView />}
          {view === "audit" && <AuditView />}
          {view === "class-sections" && <ClassSectionsView />}
          {view === "backup-restore" && <BackupRestoreView />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Global search modal + Session warning (rendered for authenticated users only) */}
      <GlobalSearchModal />
      <SessionWarning />
    </div>
  );
}
