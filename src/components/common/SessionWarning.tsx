"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * SessionWarning — shows a dialog 5 minutes before the NextAuth session expires.
 * Gives the user a chance to save their work and either re-login or extend.
 *
 * Note: actual "session extension" requires a server-side refresh — we approximate
 * it by triggering a fetch to /api/dashboard (which validates the session) and
 * refresh the page state.
 */
const WARNING_THRESHOLD_MIN = 5; // 5 minutes before expiry

export function SessionWarning() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;

    // Compute expiry
    const expiresAt = (session as any).expiresAt as number | undefined;
    if (!expiresAt) return; // some setups don't expose it

    const checkInterval = setInterval(() => {
      const remainingMs = expiresAt - Date.now();
      const remainingMin = Math.floor(remainingMs / 60000);
      if (remainingMs <= 0) {
        setOpen(false);
        toast.error("انتهت جلستك. يرجى تسجيل الدخول من جديد.");
        signOut({ callbackUrl: "/" });
      } else if (remainingMin <= WARNING_THRESHOLD_MIN && remainingMin >= 0) {
        setMinutesLeft(remainingMin);
        setOpen(true);
      } else {
        setOpen(false);
      }
    }, 30 * 1000); // check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [session, status]);

  function handleStay() {
    // Refresh by reloading — the JWT has maxAge 8h, calling any API keeps cookie alive
    window.location.reload();
  }

  function handleLogout() {
    setOpen(false);
    signOut({ callbackUrl: "/" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>تنبيه انتهاء الجلسة</DialogTitle>
          <DialogDescription>
            {minutesLeft !== null && minutesLeft > 0
              ? `ستنتهي جلستك خلال ${minutesLeft} دقيقة. احفظ عملك قبل فوات الأوان.`
              : "جلستك على وشك الانتهاء. سيتم تسجيل خروجك تلقائيًا."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleLogout}>
            تسجيل الخروج الآن
          </Button>
          <Button onClick={handleStay}>
            تمديد الجلسة (إعادة تحميل)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
