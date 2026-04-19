"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { useSearchParams, usePathname } from "next/navigation";
import { getRoomRedirect } from "@/lib/utils/room-redirect";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { anyId } from "promptparse/generate";
import { toast } from "sonner";
import { roomQueries } from "@/lib/queries/rooms";
import { useClaimPayment, useConfirmPayment, useRejectPayment, useUnconfirmPayment, useNudgeMember, useNudgeAll } from "@/lib/mutations/rooms";
import { useRoomSocket } from "@/lib/hooks/use-room-socket";
import { useSlipScanner } from "@/lib/hooks/use-slip-scanner";
import type { SlipScanOutput } from "@/lib/hooks/use-slip-scanner";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { useLiff } from "@/lib/hooks/use-liff";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { buildTrackingFlexMessage } from "@/lib/liff-messages";
import { api } from "@/lib/api-client";
import { ScanProgress } from "@/components/tracking/scan-progress";
import { ScanResultBadge } from "@/components/tracking/scan-result-badge";
import { SlipModal } from "@/components/tracking/slip-modal";
import { StoryCard } from "@/components/bill/story-card";
// html2canvas removed — recap images now generated server-side via Satori
import { statusConfig, bankNames } from "@/components/tracking/constants";
import { fireAllPaidConfetti } from "@/lib/confetti";
import { Skeleton } from "@/components/skeleton";
import { SyncIndicator } from "@/components/sync-indicator";
import { useDynamicFavicon } from "@/lib/hooks/use-dynamic-favicon";
import { Baht } from "@/components/baht";
import { CelebrationOverlay } from "@/components/tracking/celebration-overlay";
import { motion, AnimatePresence } from "motion/react";
import type { PaymentStatus } from "@/components/tracking/constants";

// ─── Main component ───

export default function PaymentTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12"><Skeleton className="h-4 w-12" /><Skeleton className="mt-3 h-9 w-48" /><Skeleton className="mt-2 h-4 w-36" /><Skeleton className="mt-6 h-20 rounded-2xl" /><Skeleton className="mt-4 h-16 rounded-2xl" /><Skeleton className="mt-4 h-24 rounded-2xl" /></div>}>
      <PaymentTrackingContent params={params} />
    </Suspense>
  );
}

function PaymentTrackingContent({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slipModal, setSlipModal] = useState<{
    image: string;
    memberName: string;
    amount: number;
    bankCode: string | null;
    verifiedAmount: number | null;
  } | null>(null);

  // Member slip flow state — gates the entire action area to prevent stale UI flashes
  type SlipFlowState =
    | { step: "idle" }
    | { step: "scanning"; paymentId: string }
    | { step: "preview"; paymentId: string; output: SlipScanOutput }
    | { step: "submitting"; paymentId: string; output: SlipScanOutput }
    | { step: "done"; previousStatus: string }; // hold until server status changes from what it was

  const [slipFlow, setSlipFlow] = useState<SlipFlowState>({ step: "idle" });
  const identifyingRef = useRef(false);

  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";
  const currentMemberId = codeData?.currentMemberId;

  // Auto-identify: when opened from LIFF with ?identify=memberId,
  // call the identify endpoint to set the cookie, then refetch.
  const identifyParam = searchParams.get("identify");
  useEffect(() => {
    if (!identifyParam || !code || identifyingRef.current || currentMemberId) return;
    identifyingRef.current = true;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rooms/code/${code}/identify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ memberId: identifyParam }),
    })
      .then((res) => {
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["rooms", "code", code] });
        }
      })
      .finally(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("identify");
        window.history.replaceState({}, "", url.toString());
        identifyingRef.current = false;
      });
  }, [identifyParam, code, currentMemberId, queryClient]);

  const { data: detailData, isFetching: isDetailFetching } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId && !!currentMemberId,
    retry: false,
  });

  const room = detailData?.room;
  const members = room?.members ?? [];
  const payments = room?.payments ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;
  const hostMember = members.find((m) => m.isHost);
  const pathname = usePathname();

  // Status guard: redirect if room is not in payment/settled
  // Skip while fetching — prevents redirect based on stale cache
  useEffect(() => {
    if (!room || isDetailFetching) return;
    const redirect = getRoomRedirect(code, room.status, isHost, pathname);
    if (redirect) router.replace(redirect);
  }, [room, code, isHost, pathname, router, isDetailFetching]);

  const claimPayment = useClaimPayment(roomId);
  const confirmPayment = useConfirmPayment(roomId);
  const rejectPayment = useRejectPayment(roomId);
  const unconfirmPayment = useUnconfirmPayment(roomId);
  const nudgeMember = useNudgeMember(roomId);
  const nudgeAll = useNudgeAll(roomId);
  const { result: slipResult, previewUrl, scanSlip, reset: resetSlip } = useSlipScanner();

  // Nudge cooldown tracking (client-side for instant UI feedback; server enforces real limits)
  const [nudgeCooldowns, setNudgeCooldowns] = useState<Record<string, number>>({});
  const [globalNudgeCooldown, setGlobalNudgeCooldown] = useState(0);

  // Current time — updated every second for cooldown/countdown displays.
  // Using state instead of Date.now() in render to satisfy react-hooks/purity.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket: instant updates when payment statuses change
  useRoomSocket(code);

  // Push notifications
  const push = usePushNotifications(roomId, currentMemberId);
  const [iosDismissed, setIosDismissed] = useState(false);


  // Keep screen awake while QR code is showing
  const myPayment = payments.find((p) => p.memberId === currentMemberId);
  useWakeLock(!isHost && !!myPayment && myPayment.status !== "confirmed" && !!room?.promptpayId);

  // Story card for sharing
  const storyCardRef = useRef<HTMLDivElement>(null);

  // LINE LIFF sharing
  const liff = useLiff();
  const lineLinkRef = useRef(false);

  // Auto-link LINE identity when viewing tracking page inside LIFF
  useEffect(() => {
    console.log("[line-link] Check:", { isReady: liff.isReady, isInClient: liff.isInClient, currentMemberId, roomId, alreadyLinked: lineLinkRef.current });
    if (!liff.isReady || !liff.isInClient || !currentMemberId || !roomId || lineLinkRef.current) return;
    lineLinkRef.current = true;

    const idToken = liff.liff?.getIDToken();
    console.log("[line-link] ID token:", idToken ? `${idToken.slice(0, 20)}...` : "null");
    if (!idToken) return;

    api.api.rooms[":id"]["line-link"].$post({
      param: { id: roomId },
      json: { idToken },
    }).then((res) => {
      console.log("[line-link] Response:", res.status, res.ok);
    }).catch((err) => {
      console.error("[line-link] Failed:", err);
    });
  }, [liff.isReady, liff.isInClient, liff.liff, currentMemberId, roomId]);

  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const confirmedPayments = payments.filter((p) => p.status === "confirmed");
  const confirmedTotal = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const confirmedCount = confirmedPayments.length;
  const allPaid = confirmedCount === payments.length && payments.length > 0;
  const hasClaimed = payments.some((p) => p.status === "claimed");

  // Dynamic favicon — catfish with blush → bell badge → checkmark badge
  useDynamicFavicon(allPaid ? "allPaid" : hasClaimed ? "claimed" : "default");

  // Celebration overlay — show when all paid, dismissable by host
  const hasFiredConfetti = useRef(false);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const showCelebration = allPaid && !celebrationDismissed;

  useEffect(() => {
    if (allPaid && !hasFiredConfetti.current) {
      hasFiredConfetti.current = true;
      queueMicrotask(() => setCelebrationDismissed(false));
      fireAllPaidConfetti();
    }
    if (!allPaid) {
      hasFiredConfetti.current = false;
    }
  }, [allPaid]);


  // Recap image sharing — two-tap pattern for reliable navigator.share({ files })
  const [recapState, setRecapState] = useState<"idle" | "loading" | "ready">("idle");
  const [recapPreviewUrl, setRecapPreviewUrl] = useState<string | null>(null);
  const recapBlobRef = useRef<Blob | null>(null);

  const handleShareRecap = async () => {
    // If image already cached, show preview immediately
    if (recapBlobRef.current) {
      setRecapPreviewUrl(URL.createObjectURL(recapBlobRef.current));
      setRecapState("ready");
      return;
    }
    // Start fetching
    setRecapState("loading");
    try {
      const billItems = room?.billItems || [];
      const recapStats: { label: string; name: string; detail: string; icon: string }[] = [];
      if (payments.length > 0) {
        const sorted = [...payments].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
        const topMember = members.find(m => m.id === sorted[0].memberId);
        if (topMember) recapStats.push({ label: "BIG SPENDER", name: topMember.displayName, detail: `฿${parseFloat(sorted[0].amount).toFixed(2)}`, icon: "crown" });
      }
      if (room?.finalizedAt) {
        const claimed = payments.filter(p => p.claimedAt).sort((a, b) => new Date(a.claimedAt!).getTime() - new Date(b.claimedAt!).getTime());
        if (claimed.length > 0) {
          const fm = members.find(m => m.id === claimed[0].memberId);
          const mins = Math.max(0, Math.floor((new Date(claimed[0].claimedAt!).getTime() - new Date(room.finalizedAt).getTime()) / 60000));
          if (fm) recapStats.push({ label: "FASTEST PAYER", name: fm.displayName, detail: mins < 1 ? "instantly" : `${mins}m`, icon: "lightning" });
        }
      }
      if (billItems.length > 0) {
        const withCounts = billItems.map(item => ({ name: item.name, splitCount: item.splits?.length || 0 }));
        const popular = [...withCounts].sort((a, b) => b.splitCount - a.splitCount)[0];
        if (popular && popular.splitCount > 1) recapStats.push({ label: "MOST POPULAR", name: popular.name, detail: `${popular.splitCount} people`, icon: "plate" });
      }
      const res = await fetch("/api/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: room?.name || "Bill Split",
          date: room?.createdAt ? new Date(room.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "",
          total: total.toFixed(2),
          memberCount: String(payments.length),
          itemCount: String(billItems.length),
          stats: recapStats,
          members: members.slice(0, 8).map((m, i) => ({
            initial: m.displayName.charAt(0).toUpperCase(),
            color: ["#8B6914", "#B08A56", "#6D8B5E", "#C49A3C", "#9B7A6E", "#6A8BA0", "#C47A5A", "#A06B7A"][i % 8],
          })),
        }),
      });
      recapBlobRef.current = await res.blob();
      setRecapPreviewUrl(URL.createObjectURL(recapBlobRef.current));
      setRecapState("ready");
    } catch {
      toast.error("Couldn't generate recap");
      setRecapState("idle");
    }
  };

  const closeRecapPreview = () => {
    if (recapPreviewUrl) URL.revokeObjectURL(recapPreviewUrl);
    setRecapPreviewUrl(null);
    setRecapState("idle");
  };

  // Called from preview modal — fresh user gesture = reliable share
  const handleShareFromPreview = async () => {
    if (!recapBlobRef.current) return;
    const file = new File([recapBlobRef.current], "pladuk-recap.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "PlaDuk Recap" });
        toast.success("Shared!");
        closeRecapPreview();
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    // Fallback: download
    const url = URL.createObjectURL(recapBlobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pladuk-recap.png";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Saved!");
    closeRecapPreview();
  };

  // Handle slip file selection — set scanning state SYNCHRONOUSLY before async work
  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>, paymentId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediately gate UI to "scanning" — prevents stale state flash
    setSlipFlow({ step: "scanning", paymentId });

    const output = await scanSlip(file);
    if (output) {
      setSlipFlow({ step: "preview", paymentId, output });
    } else {
      // Scan failed entirely — go back to idle so user can retry
      setSlipFlow({ step: "idle" });
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit the scanned slip
  const handleConfirmClaim = (currentStatus: string) => {
    if (slipFlow.step !== "preview") return;
    const { paymentId, output } = slipFlow;
    setSlipFlow({ step: "submitting", paymentId, output });

    claimPayment.mutate(
      {
        paymentId,
        slipData: output.slipData ?? undefined,
        slipImage: output.slipImage,
      },
      {
        onSuccess: () => {
          setSlipFlow({ step: "done", previousStatus: currentStatus });
          resetSlip();
        },
        onError: () => {
          // Go back to preview so they can retry
          setSlipFlow({ step: "preview", paymentId, output });
          toast.error("Couldn't submit — try again 😅");
        },
      }
    );
  };

  // Cancel the pending scan
  const handleCancelScan = () => {
    setSlipFlow({ step: "idle" });
    resetSlip();
  };

  // Still loading initial data or auto-identifying
  if (!codeData || identifyParam) {
    return (
      <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-3 h-9 w-48" />
        <Skeleton className="mt-6 h-20 rounded-2xl" />
        <Skeleton className="mt-4 h-32 rounded-2xl" />
      </div>
    );
  }

  // No identity and not in LIFF — show member picker so user can identify themselves
  if (codeData && !currentMemberId && !push.isLiff) {
    const roomMembers = codeData.room?.members ?? [];
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <h2 className="font-caveat text-3xl font-bold">
          Who are you?
        </h2>
        <p className="mt-2 text-sm text-brand-400">
          Tap your name to continue.
        </p>
        <div className="mt-4 flex w-full max-w-xs flex-col gap-2">
          {roomMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={async () => {
                await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/code/${code}/identify`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ memberId: m.id }),
                  },
                );
                queryClient.invalidateQueries({ queryKey: ["rooms", "code", code] });
              }}
              className="rounded-xl border border-brand-200 bg-cream-light px-4 py-3 text-left text-sm font-medium transition-all hover:bg-cream active:scale-[0.98]"
            >
              {m.displayName}
              {m.isHost && (
                <span className="ml-2 text-xs text-brand-300">(host)</span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-3 h-9 w-48" />
        <Skeleton className="mt-6 h-20 rounded-2xl" />
        <Skeleton className="mt-4 h-16 rounded-2xl" />
        <Skeleton className="mt-4 h-24 rounded-2xl" />
      </div>
    );
  }

  // Compute relative time for finalized display
  const finalizedAgo = room.finalizedAt ? (() => {
    const mins = Math.floor((now - new Date(room.finalizedAt).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })() : null;

  return (
    <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Header */}
      <button
        type="button"
        onClick={() => router.replace("/home")}
        className="self-start text-sm text-brand-400 hover:text-brand-700"
      >
        Back
      </button>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="font-caveat text-3xl font-bold md:text-4xl">
          {room.name || "Payment Tracking"}
        </h1>
        <SyncIndicator roomCode={code} />
      </div>
      <p className="mt-1 font-serif text-sm italic text-brand-400">
        {isHost ? "Track who has paid." : "See how much you owe."}
      </p>
      {room.finalizedAt && (
        <p className="mt-1 text-xs text-brand-300">
          Bill finalized {new Date(room.finalizedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          {" · "}{finalizedAgo}
        </p>
      )}

      {/* Share buttons row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Share via LINE */}
        {isHost && liff.isSupported && (
          <button
            type="button"
            disabled={!liff.isReady}
            onClick={async () => {
              if (!room) return;
              const trackingUrl = `${window.location.origin}/quick-split/${code}/tracking`;
              const message = buildTrackingFlexMessage({
                roomName: room.name || `${room.hostName}'s Split`,
                hostName: hostMember?.displayName ?? room.hostName ?? "Host",
                total,
                paidCount: confirmedCount,
                memberCount: payments.length,
                trackingUrl,
              });
              try {
                const result = await liff.shareTargetPicker([message]);
                if (result) toast.success("Shared to LINE! 💚");
              } catch (err) {
                console.error("[liff] Share failed:", err);
                toast.error("Couldn't share to LINE");
              }
            }}
            className="flex items-center gap-1.5 rounded-full bg-[#5a9e6e] px-4 py-1.5 text-sm font-medium text-cream-light shadow-sm transition-all hover:bg-[#4e8c60] active:scale-[0.97] disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
            LINE
          </button>
        )}

        {/* Share Recap — when all confirmed */}
        {confirmedCount === payments.length && payments.length > 0 && (
          <button
            type="button"
            onClick={handleShareRecap}
            className="flex items-center gap-1.5 rounded-full border border-brand-200 px-4 py-1.5 text-sm font-medium text-brand-500 transition-colors hover:bg-cream-light"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Recap
          </button>
        )}
      </div>

      {/* PromptPay QR + amount + claim button — shown to non-host members */}
      {!isHost && currentMemberId && (() => {
        const myPayment = payments.find((p) => p.memberId === currentMemberId);
        if (!myPayment) return null;
        const myAmount = parseFloat(myPayment.amount);
        const status = myPayment.status as PaymentStatus;

        // Generate PromptPay QR payload if the host set up PromptPay
        const qrPayload = room.promptpayId && status !== "confirmed"
          ? anyId({
              type: room.promptpayType === "national_id" ? "NATID" : "MSISDN",
              target: room.promptpayId,
              amount: myAmount,
            })
          : null;

        const canClaim = status === "unpaid" || status === "rejected";
        // Once server status changes from what it was when we submitted, clear the "done" hold
        if (slipFlow.step === "done" && status !== slipFlow.previousStatus) {
          // Schedule reset to avoid setState during render
          queueMicrotask(() => setSlipFlow({ step: "idle" }));
        }
        // slipFlow gates the entire action area — prevents stale state flashes
        const isInSlipFlow = slipFlow.step !== "idle";

        return (
          <>
            {/* Payment info — varies by method */}
            {status !== "confirmed" && (
              <div className="mt-4 flex flex-col items-center rounded-2xl border border-brand-200 bg-cream-light p-6 shadow-sm">
                {(!room.paymentMethod || room.paymentMethod === "promptpay") && qrPayload ? (
                  <>
                    <p className="font-heading text-sm text-brand-400">
                      Scan to pay {hostMember?.displayName}
                    </p>
                    <div className="mt-4 rounded-2xl border border-brand-100 bg-cream p-4">
                      <QRCodeSVG
                        value={qrPayload}
                        size={200}
                        fgColor="#3d2810"
                        bgColor="transparent"
                        level="M"
                      />
                    </div>
                    <Baht value={myAmount} className="mt-4 font-caveat text-3xl font-bold" />
                    <p className="mt-1 text-xs text-brand-300">
                      via PromptPay · {room.promptpayId}
                    </p>
                  </>
                ) : room.paymentMethod === "bank" ? (
                  <>
                    <p className="font-heading text-sm text-brand-400">
                      Transfer to {hostMember?.displayName}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(room.bankAccountNumber ?? "");
                        toast.success("Account number copied!");
                      }}
                      className="mt-3 rounded-xl border border-brand-100 bg-cream px-5 py-4 text-center transition-all hover:border-brand-300 hover:shadow-sm active:scale-[0.98]"
                    >
                      {room.bankName && (
                        <p className="text-sm font-semibold text-brand-600">{room.bankName}</p>
                      )}
                      <p className="mt-1 text-xs text-brand-300">Account Number · tap to copy</p>
                      <p className="mt-1 font-heading text-2xl font-bold tracking-wider">{room.bankAccountNumber}</p>
                    </button>
                    <Baht value={myAmount} className="mt-4 font-caveat text-3xl font-bold" />
                    <p className="mt-1 text-xs text-brand-300">
                      via Bank Transfer
                    </p>
                  </>
                ) : room.paymentMethod === "other" ? (
                  <>
                    <p className="font-heading text-sm text-brand-400">
                      Pay {hostMember?.displayName}
                    </p>
                    <div className="mt-3 rounded-xl border border-brand-100 bg-cream px-5 py-4 text-center">
                      <p className="text-sm text-brand-600">{room.paymentNote}</p>
                    </div>
                    <Baht value={myAmount} className="mt-4 font-caveat text-3xl font-bold" />
                  </>
                ) : null}
              </div>
            )}

            {/* Status card for the member */}
            <div className={`mt-4 rounded-2xl border p-5 shadow-sm ${
              status === "confirmed"
                ? "border-green-200 bg-green-50"
                : status === "claimed"
                  ? "border-amber-300 bg-amber-50"
                  : status === "rejected"
                    ? "border-red-300 bg-red-50"
                    : "border-brand-700 bg-brand-700"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-caveat text-lg font-medium ${
                    status === "confirmed" ? "text-green-800"
                      : status === "claimed" ? "text-amber-900"
                        : status === "rejected" ? "text-red-800"
                          : "text-cream-light"
                  }`}>
                    {status === "confirmed" ? "Payment confirmed"
                      : status === "claimed" ? "Waiting for host to confirm..."
                        : status === "rejected" ? "Payment rejected"
                          : "You owe"}
                  </span>
                  {status === "confirmed" && (
                    <p className="mt-0.5 font-serif text-xs italic text-green-600">Thank you for paying!</p>
                  )}
                  {status === "claimed" && (
                    <p className="mt-0.5 font-serif text-sm italic text-amber-700">Your claim has been submitted</p>
                  )}
                </div>
                <Baht value={myAmount} className={`text-xl font-bold ${
                  status === "confirmed" ? "text-green-800"
                    : status === "claimed" ? "text-amber-900"
                      : status === "rejected" ? "text-red-800"
                        : "text-cream-light"
                }`} />
              </div>

              {/* Hidden file input — always rendered so ref works */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSlipUpload(e, myPayment.id)}
              />

              {/* ── Slip flow: scanning ── */}
              {isInSlipFlow && slipFlow.step === "scanning" && (
                <ScanProgress status={slipResult.status} />
              )}

              {/* ── Slip flow: preview (scan done, awaiting user confirm) ── */}
              {isInSlipFlow && (slipFlow.step === "preview" || slipFlow.step === "submitting") && (
                <div className="mt-3 space-y-2">
                  {/* Thumbnail preview */}
                  {previewUrl && (
                    <div className="flex items-start gap-3 rounded-md bg-cream-light/10 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Slip preview"
                        className="h-16 w-12 rounded border border-white/20 object-cover"
                      />
                      <div className="flex-1">
                        <ScanResultBadge
                          status={slipResult.status}
                          bankName={slipResult.status === "success" && slipResult.data.sendingBank
                            ? (bankNames[slipResult.data.sendingBank] ?? slipResult.data.sendingBank)
                            : undefined}
                        />
                      </div>
                    </div>
                  )}

                  {/* Confirm / cancel buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirmClaim(status)}
                      disabled={slipFlow.step === "submitting"}
                      className="flex-1 rounded-xl bg-cream-light px-3 py-2 text-sm font-medium text-brand-800 transition-colors hover:bg-brand-50 disabled:opacity-40"
                    >
                      {slipFlow.step === "submitting" ? "Sending..." : "Send to Host"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelScan}
                      disabled={slipFlow.step === "submitting"}
                      className="rounded-xl border border-white/20 px-3 py-2 text-sm text-brand-200 transition-colors hover:bg-cream-light/10 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Default state: upload / claim buttons (only when NOT in slip flow) ── */}
              {canClaim && !isInSlipFlow && (
                <>
                  {/* Rejected hint */}
                  {status === "rejected" && (
                    <p className="mt-2 text-sm text-red-700">
                      {myPayment.slipVerifiedAmount
                        ? `Amount mismatch (slip: ฿${parseFloat(myPayment.slipVerifiedAmount).toFixed(2)}, owed: ฿${myAmount.toFixed(2)}). Upload the correct slip.`
                        : "Host rejected your claim. Upload a new slip or try again."}
                    </p>
                  )}

                  {/* Primary: Upload Slip */}
                  <button
                    type="button"
                    onClick={() => {
                      resetSlip();
                      fileInputRef.current?.click();
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-cream-light shadow-sm transition-all hover:bg-brand-800 active:scale-[0.98]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {status === "rejected" ? "Upload New Slip" : "Upload Slip & Claim"}
                  </button>

                  {/* Secondary: Claim without slip */}
                  <button
                    type="button"
                    onClick={() => claimPayment.mutate(
                      { paymentId: myPayment.id },
                      {
                        onError: () => toast.error("Couldn't submit — try again 😅"),
                      }
                    )}
                    disabled={claimPayment.isPending}
                    className="mt-2 w-full text-center text-xs text-brand-300 underline transition-colors hover:text-brand-100 disabled:opacity-40"
                  >
                    I&apos;ve paid (no slip)
                  </button>
                </>
              )}

              {/* ── Claimed / just submitted: waiting for host ── */}
              {(status === "claimed" || slipFlow.step === "done") && slipFlow.step !== "scanning" && slipFlow.step !== "preview" && slipFlow.step !== "submitting" && (
                <p className="mt-2 font-serif text-sm italic text-amber-700">
                  Waiting for host to confirm...
                </p>
              )}
              {status === "confirmed" && (
                <p className="mt-1 text-sm text-green-600">
                  Thank you!
                </p>
              )}
            </div>
          </>
        );
      })()}

      {/* Progress bar */}
      <div className="mt-6 rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
        <div className="flex justify-between text-sm">
          <span className="font-caveat text-base text-brand-500">
            {confirmedCount}/{payments.length} confirmed
          </span>
          <span className="tabular-nums font-medium">
            <Baht value={confirmedTotal} /><span className="text-brand-300">/</span><Baht value={total} />
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500 ease-out"
            style={{
              width: `${payments.length > 0 ? (confirmedCount / payments.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Story card (rendered offscreen for capture) */}
      {confirmedCount === payments.length && payments.length > 0 && (
        <StoryCard
          ref={storyCardRef}
          roomName={room.name || `${room.hostName}'s Split`}
          date={room.finalizedAt
            ? new Date(room.finalizedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : new Date(room.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          }
          totalAmount={total}
          members={payments.map((p) => ({
            displayName: p.member?.displayName ?? "?",
            image: null,
            amount: parseFloat(p.amount),
            claimedAt: p.claimedAt,
          }))}
          items={(room.billItems ?? []).map((item) => ({
            name: item.name,
            splitCount: item.splits?.length ?? 0,
          }))}
          finalizedAt={room.finalizedAt}
        />
      )}

      {/* Host: Notify All unpaid members */}
      {isHost && payments.some((p) => p.status === "unpaid" || p.status === "rejected") && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              nudgeAll.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Notified all unpaid members!");
                  const expiry = Date.now() + 5 * 60 * 1000;
                  setGlobalNudgeCooldown(expiry);
                  // Also block individual nudges for all members
                  const perMember: Record<string, number> = {};
                  for (const p of payments) {
                    if (p.status === "unpaid" || p.status === "rejected") {
                      perMember[p.memberId] = expiry;
                    }
                  }
                  setNudgeCooldowns((prev) => ({ ...prev, ...perMember }));
                },
                onError: (err) => {
                  if (err.message.includes("cooldown")) {
                    toast.error("Please wait 5 minutes between reminders");
                  } else {
                    toast.error("Couldn't send notifications");
                  }
                },
              });
            }}
            disabled={nudgeAll.isPending || globalNudgeCooldown > now}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-300 bg-brand-50 px-4 py-3 font-caveat text-base font-medium text-brand-700 shadow-sm transition-all hover:bg-brand-100 active:scale-[0.98] disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {globalNudgeCooldown > now
              ? `Wait ${Math.floor((globalNudgeCooldown - now) / 60000)}:${String(Math.floor(((globalNudgeCooldown - now) % 60000) / 1000)).padStart(2, "0")}`
              : nudgeAll.isPending ? "Sending..." : "Notify All Unpaid"}
          </button>
        </div>
      )}

      {/* LINE users: reminders sent automatically via LINE Official Account */}
      {push.isLiff && currentMemberId && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-200 bg-cream-light px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C10 2 8.5 3.5 8.5 5.5C8.5 5.5 5 7.5 5 13C5 15 3.5 16 3.5 16H20.5C20.5 16 19 15 19 13C19 7.5 15.5 5.5 15.5 5.5C15.5 3.5 14 2 12 2Z" />
            <path d="M9.5 16C9.5 17.38 10.62 19 12 19C13.38 19 14.5 17.38 14.5 16" />
            <circle cx="12" cy="2" r="0.5" fill="currentColor" stroke="none" />
            <path d="M7 4.5C5.5 3.5 4.5 4 4 4.5" strokeDasharray="2 2" />
            <path d="M17 4.5C18.5 3.5 19.5 4 20 4.5" strokeDasharray="2 2" />
          </svg>
          <div>
            <p className="font-caveat text-base font-medium text-success">Reminders enabled via LINE</p>
            <p className="text-xs text-brand-300">We&apos;ll nudge unpaid members automatically</p>
          </div>
        </div>
      )}

      {!push.isLiff && push.isIOS && !push.isPWA && !iosDismissed && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
          <p className="font-caveat text-lg font-medium">
            Want payment reminders on iPhone?
          </p>
          <ol className="mt-1 list-inside list-decimal text-xs text-brand-400 space-y-0.5">
            <li>Tap the Share button <span className="inline-block translate-y-px">&#xFEFF;&#x2B06;&#xFE0E;</span> at the bottom of Safari</li>
            <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
            <li>Open PlaDuk from your home screen</li>
            <li>Come back to this page and tap &quot;Enable Reminders&quot;</li>
          </ol>
          <button
            type="button"
            onClick={() => setIosDismissed(true)}
            className="mt-2 text-xs font-medium text-brand-400 hover:text-brand-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {push.isSupported && push.permission === "default" && (
        <div className="mt-4 rounded-xl border border-brand-200 bg-cream-light p-4">
          <p className="font-caveat text-lg font-medium">
            Get notified
          </p>
          <p className="mt-1 text-xs text-brand-400">
            {isHost
              ? "We'll tell you when someone claims they've paid."
              : "We'll send a gentle nudge if you forget. No spam, promise."}
          </p>
          <button
            type="button"
            onClick={push.subscribe}
            disabled={push.isSubscribing}
            className="mt-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-cream-light hover:bg-brand-800 disabled:opacity-50"
          >
            {push.isSubscribing ? "Setting up..." : "Enable Reminders"}
          </button>
        </div>
      )}

      {push.isSupported && push.permission === "granted" && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-200 bg-cream-light px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C10 2 8.5 3.5 8.5 5.5C8.5 5.5 5 7.5 5 13C5 15 3.5 16 3.5 16H20.5C20.5 16 19 15 19 13C19 7.5 15.5 5.5 15.5 5.5C15.5 3.5 14 2 12 2Z" />
            <path d="M9.5 16C9.5 17.38 10.62 19 12 19C13.38 19 14.5 17.38 14.5 16" />
            <circle cx="12" cy="2" r="0.5" fill="currentColor" stroke="none" />
            <path d="M7 4.5C5.5 3.5 4.5 4 4 4.5" strokeDasharray="2 2" />
            <path d="M17 4.5C18.5 3.5 19.5 4 20 4.5" strokeDasharray="2 2" />
          </svg>
          <div>
            <p className="font-caveat text-base font-medium text-success">Reminders enabled</p>
            <p className="text-xs text-brand-300">We&apos;ll send a gentle nudge if someone forgets</p>
          </div>
        </div>
      )}

      {/* Host card */}
      {hostMember && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-caveat text-lg font-medium">
              {hostMember.displayName}
              {isHost && <span className="text-brand-300"> (you)</span>}
            </span>
            <span className="text-brand-800">
              ฿{(() => {
                const hostPayment = payments.find(
                  (p) => p.memberId === hostMember.id
                );
                return hostPayment
                  ? parseFloat(hostPayment.amount).toFixed(2)
                  : "0.00";
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Member payment cards */}
      <div className="mt-2 space-y-2">
        <AnimatePresence>
        {[...payments]
          .filter((p) => p.memberId !== hostMember?.id)
          .sort((a, b) => {
            const order: Record<string, number> = { unpaid: 0, rejected: 1, claimed: 2, confirmed: 3 };
            return (order[a.status] ?? 0) - (order[b.status] ?? 0);
          })
          .map((payment) => {
            const status = payment.status as PaymentStatus;
            const config = statusConfig[status];
            const hasSlip = !!payment.slipTransRef || !!payment.slipImageData;
            const hasVerification = !!payment.slipVerifiedAmount;
            const verifiedAmount = hasVerification ? parseFloat(payment.slipVerifiedAmount!) : null;
            const owedAmount = parseFloat(payment.amount);
            const amountMatches = verifiedAmount != null && Math.abs(verifiedAmount - owedAmount) < 0.01;
            // Auto-rejected: rejected but still has slip data (manual reject wipes it)
            const isAutoRejected = status === "rejected" && hasSlip && hasVerification && !amountMatches;
            // Duplicate: another payment in this room has the same transRef
            const isDuplicate = !!payment.slipTransRef && payments.some(
              (other) => other.id !== payment.id && other.slipTransRef === payment.slipTransRef
            );

            return (
              <motion.div
                key={payment.id}
                layout
                layoutId={payment.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Status icon */}
                    {status === "confirmed" && (
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {status === "claimed" && (
                      <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {status === "unpaid" && (
                      <svg className="h-4 w-4 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {status === "rejected" && (
                      <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="font-caveat text-lg font-medium">
                      {payment.member?.displayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Baht value={parseFloat(payment.amount)} className="text-brand-800" />

                    {/* Status badge (always visible) */}
                    <span className={`rounded-xl border px-2.5 py-0.5 text-xs font-medium ${config.classes}`}>
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Next auto-reminder countdown */}
                {(status === "unpaid" || status === "rejected") && (() => {
                  const schedule = detailData?.reminderSchedule?.[payment.id];
                  if (!schedule) return null;

                  // Find next unsent tier in the future
                  let nextAt: number | null = null;
                  for (const t of schedule.tiers) {
                    if (!t.sent && new Date(t.scheduledAt).getTime() > now) {
                      nextAt = new Date(t.scheduledAt).getTime();
                      break;
                    }
                  }

                  // If all fixed tiers passed, compute next recurring
                  if (!nextAt && schedule.tiers.length > 0) {
                    const lastTier = schedule.tiers[schedule.tiers.length - 1];
                    const lastAt = new Date(lastTier.scheduledAt).getTime();
                    if (now > lastAt && schedule.recurringEveryMs > 0) {
                      const elapsed = now - lastAt;
                      const periods = Math.ceil(elapsed / schedule.recurringEveryMs);
                      nextAt = lastAt + periods * schedule.recurringEveryMs;
                    }
                  }

                  if (!nextAt) return null;
                  const diff = nextAt - now;
                  if (diff <= 0) return <p className="mt-1 text-xs text-brand-300">Reminder sending soon...</p>;

                  const hours = Math.floor(diff / (1000 * 60 * 60));
                  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  const secs = Math.floor((diff % (1000 * 60)) / 1000);
                  const timeStr = hours > 0
                    ? `${hours}h ${mins}m ${String(secs).padStart(2, "0")}s`
                    : `${mins}m ${String(secs).padStart(2, "0")}s`;

                  return (
                    <p className="mt-1 text-xs text-brand-300">
                      Next auto-reminder in {timeStr}
                    </p>
                  );
                })()}

                {/* Slip verification info — visible to host */}
                {isHost && status !== "unpaid" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {/* Auto-rejected badge */}
                    {isAutoRejected && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Amount mismatch: ฿{verifiedAmount!.toFixed(2)} ≠ ฿{owedAmount.toFixed(2)}
                      </span>
                    )}

                    {/* Slip badge — clickable to view slip image */}
                    {hasSlip && (
                      <button
                        type="button"
                        onClick={() => {
                          if (payment.slipImageData) {
                            setSlipModal({
                              image: payment.slipImageData,
                              memberName: payment.member?.displayName ?? "Member",
                              amount: owedAmount,
                              bankCode: payment.slipSendingBank ?? null,
                              verifiedAmount,
                            });
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700 ${
                          payment.slipImageData ? "cursor-pointer hover:bg-blue-100" : "cursor-default"
                        }`}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {payment.slipSendingBank
                          ? `Slip: ${bankNames[payment.slipSendingBank] ?? payment.slipSendingBank}`
                          : "Slip attached"}
                        {payment.slipImageData && (
                          <svg className="ml-0.5 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    )}

                    {/* No slip warning */}
                    {!hasSlip && status === "claimed" && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-cream-light px-2 py-0.5 text-brand-400">
                        No slip attached
                      </span>
                    )}

                    {/* Slip but no QR detected */}
                    {payment.slipImageData && !payment.slipSendingBank && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-yellow-700">
                        No QR detected
                      </span>
                    )}

                    {/* Verified amount badge (non-mismatch — mismatch shown as auto-rejected above) */}
                    {hasVerification && amountMatches && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-green-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Verified ฿{verifiedAmount!.toFixed(2)}
                      </span>
                    )}

                    {/* QR found but not verified (no API key or API failed) */}
                    {payment.slipSendingBank && !hasVerification && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50/50 px-2 py-0.5 text-blue-600">
                        QR: {bankNames[payment.slipSendingBank] ?? payment.slipSendingBank}
                      </span>
                    )}

                    {/* Duplicate transRef warning */}
                    {isDuplicate && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-orange-700">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Duplicate slip
                      </span>
                    )}
                  </div>
                )}

                {/* Host actions — confirm from any non-confirmed state, reject only claimed */}
                {/* Host: undo a confirmed payment */}
                {isHost && status === "confirmed" && (
                  <div className="mt-3 flex border-t border-brand-100 pt-3">
                    <button
                      type="button"
                      onClick={() => unconfirmPayment.mutate(payment.id, {
                        onSuccess: () => toast(`${payment.member?.displayName} unconfirmed`, { icon: "↩️", duration: 3000 }),
                        onError: () => toast.error("Couldn't unconfirm — try again"),
                      })}
                      disabled={unconfirmPayment.isPending && unconfirmPayment.variables === payment.id}
                      className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-500 transition-colors hover:bg-cream-light disabled:opacity-40"
                    >
                      {unconfirmPayment.isPending && unconfirmPayment.variables === payment.id ? "..." : "Undo Confirm"}
                    </button>
                  </div>
                )}

                {/* Host: confirm/reject/nudge actions for non-confirmed payments */}
                {isHost && status !== "confirmed" && (
                  <div className="mt-3 flex gap-2 border-t border-brand-100 pt-3">
                    <button
                      type="button"
                      onClick={() => confirmPayment.mutate(payment.id, {
                        onSuccess: () => toast.success(`${payment.member?.displayName} confirmed! 🎉`),
                        onError: () => toast.error("Couldn't confirm — try again"),
                      })}
                      disabled={confirmPayment.isPending && confirmPayment.variables === payment.id}
                      className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-40 ${
                        status === "rejected"
                          ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                          : "bg-green-100 text-green-800 hover:bg-green-200"
                      }`}
                    >
                      {confirmPayment.isPending && confirmPayment.variables === payment.id
                        ? "..."
                        : status === "rejected" ? "Override & Confirm" : "Confirm"}
                    </button>
                    {status === "claimed" && (
                      <button
                        type="button"
                        onClick={() => rejectPayment.mutate(payment.id, {
                          onSuccess: () => toast(`${payment.member?.displayName}'s claim rejected`, { icon: "🚫", duration: 3000 }),
                          onError: () => toast.error("Couldn't reject — try again"),
                        })}
                        disabled={rejectPayment.isPending && rejectPayment.variables === payment.id}
                        className="flex-1 rounded-xl bg-red-100 px-3 py-2 text-xs font-medium text-red-700 transition-all hover:bg-red-200 active:scale-[0.97] disabled:opacity-40"
                      >
                        {rejectPayment.isPending && rejectPayment.variables === payment.id ? "..." : "Reject"}
                      </button>
                    )}
                    {(status === "unpaid" || status === "rejected") && (
                      <button
                        type="button"
                        onClick={() => {
                          nudgeMember.mutate(payment.memberId, {
                            onSuccess: () => {
                              toast(`Nudged ${payment.member?.displayName}`, { icon: "🔔", duration: 3000 });
                              const expiry = Date.now() + 5 * 60 * 1000;
                              setNudgeCooldowns((prev) => ({
                                ...prev,
                                [payment.memberId]: expiry,
                              }));
                              // Also block "nudge all"
                              setGlobalNudgeCooldown(expiry);
                            },
                            onError: (err) => {
                              if (err.message.includes("cooldown")) {
                                toast.error("Wait 5 min between nudges");
                              } else {
                                toast.error("Couldn't nudge");
                              }
                            },
                          });
                        }}
                        disabled={
                          (nudgeMember.isPending && nudgeMember.variables === payment.memberId) ||
                          (nudgeCooldowns[payment.memberId] ?? 0) > now
                        }
                        className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97] disabled:opacity-40"
                      >
                        {(nudgeCooldowns[payment.memberId] ?? 0) > now
                          ? `${Math.floor(((nudgeCooldowns[payment.memberId] ?? 0) - now) / 60000)}:${String(Math.floor((((nudgeCooldowns[payment.memberId] ?? 0) - now) % 60000) / 1000)).padStart(2, "0")}`
                          : nudgeMember.isPending && nudgeMember.variables === payment.memberId
                            ? "..."
                            : "Nudge"}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Back to Home */}
      <div className="mt-auto flex justify-center pt-8">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] md:text-base"
        >
          Back to Home
        </button>
      </div>

      {/* Slip detail modal — shown when host taps a slip badge */}
      {slipModal && (
        <SlipModal
          image={slipModal.image}
          memberName={slipModal.memberName}
          amount={slipModal.amount}
          bankCode={slipModal.bankCode}
          verifiedAmount={slipModal.verifiedAmount}
          onClose={() => setSlipModal(null)}
        />
      )}

      {/* Celebration overlay — appears when all payments confirmed, dismissable */}
      <AnimatePresence>
        {showCelebration && (
          <CelebrationOverlay
            total={total}
            memberCount={payments.length}
            fastestPayer={(() => {
              const withClaim = confirmedPayments
                .filter((p) => p.claimedAt)
                .sort((a, b) => new Date(a.claimedAt!).getTime() - new Date(b.claimedAt!).getTime());
              if (withClaim.length === 0) return null;
              const fastest = withClaim[0];
              return {
                name: fastest.member?.displayName ?? "Someone",
                timeMs: new Date(fastest.claimedAt!).getTime() - new Date(room!.finalizedAt ?? room!.createdAt).getTime(),
              };
            })()}
            onDismiss={() => setCelebrationDismissed(true)}
            onShareRecap={handleShareRecap}
          />
        )}
      </AnimatePresence>

      {/* Recap image preview — loading or ready to share */}
      {recapState !== "idle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-60 flex flex-col items-center justify-center px-8"
          style={{ backgroundColor: "rgba(61, 40, 16, 0.85)" }}
          onClick={closeRecapPreview}
        >
          {recapState === "loading" && (
            <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-light/30 border-t-cream-light" />
              <p className="font-caveat text-xl text-cream-light/70">Generating your recap...</p>
            </div>
          )}

          {recapState === "ready" && recapPreviewUrl && (
            <div className="flex flex-col items-center gap-5" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recapPreviewUrl}
                alt="Recap"
                className="max-h-[68vh] rounded-2xl shadow-2xl"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleShareFromPreview}
                  className="flex items-center gap-2 rounded-full bg-cream-light px-7 py-3 text-sm font-medium text-brand-800 shadow-lg transition-all active:scale-[0.97]"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                  </svg>
                  Share
                </button>
                <button
                  type="button"
                  onClick={closeRecapPreview}
                  className="rounded-full px-5 py-3 text-sm text-cream-light/60 transition-all hover:text-cream-light"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

    </div>
  );
}
