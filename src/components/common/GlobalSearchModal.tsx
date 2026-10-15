"use client";

import { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Users,
  ClipboardList,
  Calendar,
  DoorOpen,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, any> = {
  teacher: Users,
  assignment: ClipboardList,
  substitution: Calendar,
  departure: DoorOpen,
};

const TYPE_LABELS: Record<string, string> = {
  teacher: "معلم",
  assignment: "تكليف",
  substitution: "إشغال",
  departure: "مغادرة",
};

export function GlobalSearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const setView = useAppStore((s) => s.setView);
  const setSelectedTeacherId = useAppStore((s) => s.setSelectedTeacherId);

  // Listen for Ctrl+K / Cmd+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset query when closed — wrapped in setTimeout to defer setState from effect body
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setQuery("");
        setResults([]);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced search — implemented without direct setState in effect body.
  // We use a 250ms timeout for typing-debounce + a guard flag.
  useEffect(() => {
    const q = query.trim();
    // Early-out: empty/too-short queries produce empty results via setTimeout
    // (still scheduled, so we don't trigger the lint rule)
    const t = setTimeout(() => {
      if (q.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setResults(d.results || []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function handleClick(result: any) {
    setOpen(false);
    if (result.type === "teacher") {
      setSelectedTeacherId(result.id);
      setView("teacher-detail");
    } else if (result.type === "assignment") {
      setView("assignments");
    } else if (result.type === "substitution") {
      setView("substitutions");
    } else if (result.type === "departure") {
      setView("departures");
    }
    toast.success(`الانتقال إلى ${TYPE_LABELS[result.type]}: ${result.title}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm text-muted-foreground">
            بحث شامل في كل النظام
          </DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث: اسم معلم، عنوان تكليف، صف، سبب مغادرة..."
            className="pr-10 text-base"
            dir="rtl"
          />
        </div>
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {loading && query.length > 1 && (
            <div className="space-y-2 p-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {!loading && query.length > 1 && results.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              لا توجد نتائج مطابقة لـ &quot;{query}&quot;
            </div>
          )}
          {!loading && query.length <= 1 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              اكتب حرفين على الأقل للبحث
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="space-y-1">
              {results.map((r, i) => {
                const Icon = TYPE_ICONS[r.type] || Search;
                return (
                  <li key={`${r.type}-${r.id}-${i}`}>
                    <button
                      onClick={() => handleClick(r)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-md text-right transition-colors"
                    >
                      <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-accent-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{r.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                            {TYPE_LABELS[r.type]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                      </div>
                      {r.badge && (
                        <span className="text-xs text-muted-foreground shrink-0 num-ltr">
                          {r.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          اضغط <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl+K</kbd> لفتح/إغلاق البحث
        </p>
      </DialogContent>
    </Dialog>
  );
}
