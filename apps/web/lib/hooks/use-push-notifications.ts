"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// ─── Helpers ───

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

function isInLiffBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /LIFF/i.test(navigator.userAgent) || /Line\//i.test(navigator.userAgent);
}

function detectIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
  );
}

function detectPWA(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

// ─── Hook ───

export function usePushNotifications(
  roomId: string,
  memberId: string | null | undefined,
) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_KEY &&
      !isInLiffBrowser();

    setIsSupported(supported);
    setIsIOS(detectIOS());
    setIsPWA(detectPWA());

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !memberId || !VAPID_KEY) return;

    setIsSubscribing(true);
    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });

      const keys = subscription.toJSON().keys!;

      // Send to server
      await api.api.rooms[":id"]["push-subscribe"].$post({
        param: { id: roomId },
        json: {
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh!,
          auth: keys.auth!,
        },
      });
    } catch (err) {
      console.error("[push] Subscription failed:", err);
    } finally {
      setIsSubscribing(false);
    }
  }, [isSupported, memberId, roomId]);

  return {
    permission,
    isSupported,
    isIOS,
    isPWA,
    isSubscribing,
    subscribe,
  };
}
