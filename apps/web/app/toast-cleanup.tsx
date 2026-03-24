"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import toast from "react-hot-toast";

export function ToastCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    // Dismiss all toasts when navigating to a new page
    toast.dismiss();
  }, [pathname]);

  return null;
}
