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

  return null;
}
