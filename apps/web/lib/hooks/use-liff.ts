"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type liff from "@line/liff";

type Liff = typeof liff;

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

export function useLiff() {
  const [isReady, setIsReady] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const liffRef = useRef<Liff | null>(null);

  useEffect(() => {
    if (!LIFF_ID) return;

    (async () => {
      try {
        const liffModule = (await import("@line/liff")).default;
        await liffModule.init({ liffId: LIFF_ID });
        liffRef.current = liffModule;
        setIsReady(true);
        setIsInClient(liffModule.isInClient());
      } catch (err) {
        console.warn("[liff] Init failed:", err);
      }
    })();
  }, []);

  const shareTargetPicker = useCallback(
    async (messages: Parameters<Liff["shareTargetPicker"]>[0]) => {
      const l = liffRef.current;
      if (!l) return null;

      // In external browser, user needs to be logged in
      if (!l.isInClient() && !l.isLoggedIn()) {
        l.login({ redirectUri: window.location.href });
        return null;
      }

      if (!l.isApiAvailable("shareTargetPicker")) {
        return null;
      }

      return l.shareTargetPicker(messages);
    },
    [],
  );

  return {
    isReady,
    isInClient,
    isSupported: !!LIFF_ID,
    liff: liffRef.current,
    shareTargetPicker,
  };
}
