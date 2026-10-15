"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-amber-100 text-amber-700",
  NEEDS_REVISION: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-teal-100 text-teal-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-600",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

const APPROVAL_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

const EMPLOYMENT_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  ON_LEAVE: "bg-amber-100 text-amber-700",
  INACTIVE: "bg-gray-200 text-gray-600",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status] || "")}>
      {label || status}
    </Badge>
  );
}

export function PriorityBadge({ priority, label }: { priority: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", PRIORITY_STYLES[priority] || "")}>
      {label || priority}
    </Badge>
  );
}

export function ApprovalBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", APPROVAL_STYLES[status] || "")}>
      {label || status}
    </Badge>
  );
}

export function EmploymentBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", EMPLOYMENT_STYLES[status] || "")}>
      {label || status}
    </Badge>
  );
}
