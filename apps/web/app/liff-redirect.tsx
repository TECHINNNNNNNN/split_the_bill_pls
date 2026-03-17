"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

/**
 * Handles LIFF login redirect.
 * After LINE Login, LINE redirects to the LIFF endpoint URL (root)
 * with ?liff.state=/original/path. This component reads that param
 * and redirects to the correct page.
 */
export function LiffRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const liffState = searchParams.get("liff.state");
    if (liffState && liffState.startsWith("/")) {
      router.replace(liffState);
    }
  }, [searchParams, router]);

  return null;
}
