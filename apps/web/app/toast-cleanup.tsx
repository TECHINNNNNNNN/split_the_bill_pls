"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";

export function ToastCleanup() {
  const pathname = usePathname();

  // Dismiss all toasts on page navigation
  useEffect(() => {
    toast.dismiss();
  }, [pathname]);

  // Dismiss stale toasts when returning from background (iOS Safari throttles setTimeout)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        toast.dismiss();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Tap any toast to dismiss it (fallback for stuck toasts on iOS)
  useEffect(() => {
    const handleTap = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      const toastEl = target.closest("[data-sonner-toast], [role='status']");
      if (toastEl) toast.dismiss();
    };
    document.addEventListener("click", handleTap);
    return () => document.removeEventListener("click", handleTap);
  }, []);

  return null;
}
