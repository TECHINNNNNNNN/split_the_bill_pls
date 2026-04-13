"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { ShareCard } from "@/components/bill/share-card";
import { useRouter, usePathname } from "next/navigation";
import { getCorrectRoomPath } from "@/lib/utils/room-redirect";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { calculateSplit } from "@pladuk/shared/utils";
import { roomQueries } from "@/lib/queries/rooms";
import { useFinalizeRoom, useScanReceipt, useParseVoice } from "@/lib/mutations/rooms";
import { useBillCollab, type CollabItem } from "@/lib/hooks/use-bill-collab";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { usePresence } from "@/lib/hooks/use-presence";
import { SectionCard } from "@/components/bill/section-card";
import { BreakdownModal } from "@/components/bill/breakdown-modal";
import { LiveCursors } from "@/components/bill/live-cursors";
import { PresenceAvatars } from "@/components/bill/presence-avatars";
import { useShake } from "@/lib/hooks/use-shake";
import type { SectionBreakdown } from "@/components/bill/breakdown-modal";
import { VoiceWaveform } from "@/components/voice-waveform";
import { Skeleton } from "@/components/skeleton";
import { Baht } from "@/components/baht";

// ─── Main Page ───

export default function BillDetailsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch room by code to get the room ID + members
  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";

  // Fetch full room details (for members list)
  const { data: detailData } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
  });

  const room = detailData?.room;
  const currentMemberId = codeData?.currentMemberId ?? "";
  const members = room?.members ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;
  const pathname = usePathname();

  // Status guard: redirect if room has moved past splitting
  useEffect(() => {
    if (!room) return;
    const correctPath = getCorrectRoomPath(code, room.status, isHost);
    if (pathname !== correctPath) {
      router.replace(correctPath);
    }
  }, [room, code, isHost, pathname, router]);

  // Warn on accidental refresh/close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ─── Collaborative editing via PartyKit WebSocket ───
  const {
    socket,
    sections,
    isLocked,
    addSection,
    updateSection,
    deleteSection,
    addItem,
    updateItem,
    deleteItem,
    bumpMemberShare,
    resetMemberShare,
    selectAll,
    updateExtras,
  } = useBillCollab(code, {
    currentMemberId,
    isHost,
    members,
    onStatusChanged: (status) => {
      if (status === "payment" && !isHost) {
        router.replace(`/quick-split/${code}/tracking`);
      }
    },
  });

  // ─── Live cursors & presence ───
  const billContainerRef = useRef<HTMLDivElement>(null);
  const currentDisplayName = members.find((m) => m.id === currentMemberId)?.displayName ?? "";
  const { cursors, onlineUsers } = usePresence(socket, billContainerRef, currentMemberId, currentDisplayName);

  // ─── Shake to split equally ───
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const handleShake = () => {
    for (const sec of sections) {
      for (const item of sec.items) {
        selectAll(item.id, sec.id);
      }
    }
    toast.success("Shook! Everything split equally 🤝");
  };
  const { requestPermission: requestShakePermission, isSupported: shakeSupported } = useShake(
    handleShake,
    shakeEnabled && !isLocked && sections.some((s) => s.items.length > 0),
  );

  // Breakdown modal state
  const [showBreakdown, setShowBreakdown] = useState(false);


  // Finalize mutation
  const finalizeRoom = useFinalizeRoom(roomId);

  // Receipt OCR scan
  const scanReceipt = useScanReceipt();
  const singleSectionFileRef = useRef<HTMLInputElement>(null);

  const handleScanReceipt = async (file: File, sectionId?: string) => {
    const toastId = toast.loading("Scanning receipt...");
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      const result = await scanReceipt.mutateAsync(base64);

      if (result.items.length === 0) {
        toast.error("Couldn't find any items on this receipt", { id: toastId });
        return;
      }

      // Bulk-add items to the target section
      for (const item of result.items) {
        addItem(item.name, item.unitPrice, sectionId, item.quantity);
      }

      // Auto-set extras if detected
      if (result.vatRate != null) updateExtras({ vatRate: result.vatRate }, sectionId);
      if (result.serviceChargeRate != null) updateExtras({ serviceChargeRate: result.serviceChargeRate }, sectionId);
      if (result.discountAmount != null) updateExtras({ discountAmount: result.discountAmount }, sectionId);

      toast.success(`Added ${result.items.length} items from receipt`, { id: toastId });
    } catch {
      toast.error("Failed to scan receipt — try again or add items manually", { id: toastId });
    }
  };

  // Voice-to-Bill
  const parseVoice = useParseVoice();
  const voice = useVoiceInput();
  const [voiceSectionId, setVoiceSectionId] = useState<string | null>(null);

  const handleVoiceResult = async (audioBlob: Blob, sectionId?: string) => {
    const toastId = toast.loading("Processing voice input...");
    try {
      const result = await parseVoice.mutateAsync(audioBlob);

      const hasItems = result.items.length > 0;

      // Calculate flat discount from percentage using section's existing + new items
      let discountAmount = result.discountAmount;
      if (discountAmount == null && result.discountPct != null && result.discountPct > 0) {
        const section = sections.find((s) => s.id === sectionId) ?? sections[0];
        const existingSubtotal = section?.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) ?? 0;
        const newSubtotal = result.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        const totalSubtotal = existingSubtotal + newSubtotal;
        if (totalSubtotal > 0) {
          discountAmount = Math.round(totalSubtotal * result.discountPct / 100 * 100) / 100;
        }
      }

      const hasExtras = result.vatRate != null || result.serviceChargeRate != null || discountAmount != null;

      if (!hasItems && !hasExtras) {
        toast.error("Couldn't find any items or extras — try again", { id: toastId });
        return;
      }

      for (const item of result.items) {
        addItem(item.name, item.unitPrice, sectionId, item.quantity);
      }

      if (result.vatRate != null) updateExtras({ vatRate: result.vatRate }, sectionId);
      if (result.serviceChargeRate != null) updateExtras({ serviceChargeRate: result.serviceChargeRate }, sectionId);
      if (discountAmount != null) updateExtras({ discountAmount }, sectionId);

      const parts: string[] = [];
      if (hasItems) parts.push(`${result.items.length} items`);
      if (result.vatRate != null) parts.push(`VAT ${(result.vatRate * 100).toFixed(0)}%`);
      if (result.serviceChargeRate != null) parts.push(`SC ${(result.serviceChargeRate * 100).toFixed(0)}%`);
      if (discountAmount != null) parts.push(`discount ฿${discountAmount}`);
      toast.success(`Added ${parts.join(", ")} from voice`, { id: toastId });
    } catch {
      toast.error("Failed to process voice — try again", { id: toastId });
    }
  };

  const isMultiSection = sections.length > 1;

  // Grand total across all sections
  const grandTotal = sections.reduce((total, sec) => {
    const subtotal = sec.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const discount = sec.extras.discountAmount ?? 0;
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const scRate = sec.extras.serviceChargeRate ?? 0;
    const vRate = sec.extras.vatRate ?? 0;
    const serviceChargeAmount = discountedSubtotal * scRate;
    const vatAmount = (discountedSubtotal + serviceChargeAmount) * vRate;
    return total + discountedSubtotal + serviceChargeAmount + vatAmount;
  }, 0);

  const totalItems = sections.reduce((sum, sec) => sum + sec.items.length, 0);

  // Live split preview — runs calculateSplit per section and merges per-member totals
  // Also builds sectionBreakdowns for the calculation breakdown modal
  const { liveSplits, sectionBreakdowns } = useMemo(() => {
    if (totalItems === 0 || members.length === 0) {
      return { liveSplits: [], sectionBreakdowns: [] };
    }

    const memberTotalMap = new Map<string, number>();
    const breakdowns: SectionBreakdown[] = [];

    for (const sec of sections) {
      if (sec.items.length === 0) continue;

      // Only include items that have at least one member assigned
      const assignedItems = sec.items.filter((item) => item.memberIds.length > 0);
      if (assignedItems.length === 0) continue;

      const calcItems = assignedItems.map((item) => ({
        id: item.id,
        name: item.name,
        totalPrice: item.quantity * item.unitPrice,
      }));

      const calcClaims = assignedItems.flatMap((item) =>
        Object.entries(item.memberShares ?? {}).map(([mId, share]) => ({
          billItemId: item.id,
          memberId: mId,
          share,
        }))
      );

      const subtotal = calcItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const discount = sec.extras.discountAmount ?? 0;
      const discountedSubtotal = Math.max(0, subtotal - discount);
      const scRate = sec.extras.serviceChargeRate ?? 0;
      const vRate = sec.extras.vatRate ?? 0;
      const serviceChargeAmount = discountedSubtotal * scRate;
      const vatAmount = (discountedSubtotal + serviceChargeAmount) * vRate;
      const sectionTotal = discountedSubtotal + serviceChargeAmount + vatAmount;

      const calcTotals = {
        subtotal,
        discountAmount: discount || null,
        vatAmount: vatAmount || null,
        serviceChargeAmount: serviceChargeAmount || null,
        totalAmount: sectionTotal,
      };

      const splitMemberIds = [...new Set(calcClaims.map((cl) => cl.memberId))];
      if (splitMemberIds.length === 0) continue;

      const result = calculateSplit(calcItems, calcClaims, calcTotals, splitMemberIds);

      // Build item share info for breakdown modal
      const itemShareInfo = new Map<string, { totalShares: number; memberShares: Record<string, number> }>();
      for (const item of assignedItems) {
        const ms = item.memberShares ?? {};
        const totalShares = Object.values(ms).reduce((sum, s) => sum + s, 0);
        itemShareInfo.set(item.id, { totalShares, memberShares: ms });
      }

      breakdowns.push({
        sectionName: sec.name || "Bill",
        subtotal,
        discountAmount: discount,
        serviceChargeAmount,
        vatAmount,
        sectionTotal,
        splits: result.splits,
        roundingDifference: result.roundingDifference,
        itemShareInfo,
      });

      for (const split of result.splits) {
        memberTotalMap.set(
          split.memberId,
          (memberTotalMap.get(split.memberId) || 0) + split.totalAmount,
        );
      }
    }

    const liveSplits = members
      .map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        isHost: (m as { isHost?: boolean }).isHost ?? false,
        total: memberTotalMap.get(m.id) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);

    return { liveSplits, sectionBreakdowns: breakdowns };
  }, [sections, members, totalItems]);

  // Share card data (derived from liveSplits)
  const myShare = liveSplits.find((s) => s.memberId === currentMemberId)?.total ?? 0;
  const myName = liveSplits.find((s) => s.memberId === currentMemberId)?.displayName?.split(" ")[0] ?? "You";
  const myItemCount = sections.reduce(
    (count, sec) => count + sec.items.filter((item) => currentMemberId in (item.memberShares ?? {})).length,
    0,
  );


  const handleFinalize = () => {
    // Validate: every item in every section must have at least 1 person
    for (const sec of sections) {
      const hasEmpty = sec.items.some((item) => Object.keys(item.memberShares ?? {}).length === 0);
      if (hasEmpty) {
        toast.error(`Every item needs at least one person assigned${isMultiSection && sec.name ? ` (${sec.name})` : ""} 🍽️`);
        return;
      }
    }

    const mapItems = (items: CollabItem[]) =>
      items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        memberShares: item.memberShares ?? {},
        memberIds: item.memberIds, // backward compat
      }));

    if (isMultiSection) {
      finalizeRoom.mutate(
        {
          sections: sections.map((sec) => ({
            name: sec.name || "Untitled",
            items: mapItems(sec.items),
            vatRate: sec.extras.vatRate,
            serviceChargeRate: sec.extras.serviceChargeRate,
            discountAmount: sec.extras.discountAmount,
          })),
        },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["rooms"] });
            await queryClient.invalidateQueries({ queryKey: ["room"] });
            router.push(`/quick-split/${code}/payment`);
          },
          onError: () => {
            toast.error("Couldn't finalize — try again 😵");
            // Room may have already advanced — refetch to trigger status guard redirect
            queryClient.invalidateQueries({ queryKey: ["room"] });
          },
        },
      );
    } else {
      const sec = sections[0];
      if (!sec) return;
      finalizeRoom.mutate(
        {
          items: mapItems(sec.items),
          vatRate: sec.extras.vatRate,
          serviceChargeRate: sec.extras.serviceChargeRate,
          discountAmount: sec.extras.discountAmount,
        },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["rooms"] });
            await queryClient.invalidateQueries({ queryKey: ["room"] });
            router.push(`/quick-split/${code}/payment`);
          },
          onError: () => {
            toast.error("Couldn't finalize — try again 😵");
            // Room may have already advanced — refetch to trigger status guard redirect
            queryClient.invalidateQueries({ queryKey: ["room"] });
          },
        },
      );
    }
  };

  // Show a transition screen while finalize is in flight or just completed
  if (finalizeRoom.isPending || finalizeRoom.isSuccess) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" />
        <p className="font-heading text-lg font-medium text-brand-600">Calculating splits...</p>
        <p className="text-sm text-brand-300">Setting up payment</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  // For single section, compute breakdown values for display
  const singleSection = !isMultiSection ? sections[0] : null;
  const singleExtras = singleSection?.extras;
  const singleSubtotal = singleSection?.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) ?? 0;
  const singleDiscount = singleExtras?.discountAmount ?? 0;
  const singleDiscountedSubtotal = Math.max(0, singleSubtotal - singleDiscount);
  const singleScRate = singleExtras?.serviceChargeRate ?? 0;
  const singleVRate = singleExtras?.vatRate ?? 0;
  const singleServiceCharge = singleDiscountedSubtotal * singleScRate;
  const singleVat = (singleDiscountedSubtotal + singleServiceCharge) * singleVRate;

  return (
    <div ref={billContainerRef} className="relative flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Live cursors overlay */}
      <LiveCursors cursors={cursors} members={members} containerRef={billContainerRef} />

      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.replace(`/quick-split/${code}`)}
          className="text-sm text-brand-400 hover:text-brand-700"
        >
          Back
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-caveat text-3xl font-bold md:text-4xl">
              Bill Details
            </h1>
            <PresenceAvatars onlineUsers={onlineUsers} members={members} currentMemberId={currentMemberId} />
          </div>
          {!isLocked && !isMultiSection && (
            <div className="flex items-center gap-2">
              <input
                ref={singleSectionFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleScanReceipt(file, sections[0]?.id);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => singleSectionFileRef.current?.click()}
                disabled={scanReceipt.isPending}
                className="flex items-center gap-1.5 rounded-full border border-brand-200 p-2.5 text-sm font-medium text-brand-500 transition-colors hover:bg-cream-light disabled:opacity-40 md:px-3 md:py-1.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs md:text-sm">{scanReceipt.isPending ? "Scanning..." : "Scan"}</span>
              </button>
              {voice.isSupported && (
                <button
                  type="button"
                  onClick={async () => {
                    if (voice.isRecording) {
                      const blob = await voice.stop();
                      handleVoiceResult(blob, sections[0]?.id);
                    } else {
                      voice.start();
                    }
                  }}
                  disabled={parseVoice.isPending}
                  className={`flex items-center gap-1.5 rounded-full border p-2.5 text-sm font-medium transition-colors disabled:opacity-40 md:px-3 md:py-1.5 ${
                    voice.isRecording
                      ? "border-[#D4A5A5] bg-[#faf0f0] text-[#c75450]"
                      : "border-brand-200 text-brand-500 hover:bg-cream-light"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  </svg>
                  <span className="hidden md:inline">
                    {parseVoice.isPending
                      ? "Processing..."
                      : voice.isRecording
                        ? `Stop (${voice.duration}s)`
                        : "Voice"}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Sticky "Your share" bar ─── */}
      {!isLocked && (
        <ShareCard name={myName} amount={myShare} itemCount={myItemCount} />
      )}

      {/* Voice waveform — single-section mode */}
      {voice.isRecording && !isMultiSection && (
        <VoiceWaveform analyser={voice.analyser} duration={voice.duration} />
      )}

      {/* Shake to split — mobile only */}
      {!isLocked && shakeSupported && totalItems > 0 && (
        shakeEnabled ? (
          <p className="mt-4 flex items-center justify-center gap-2 text-center font-caveat text-sm text-brand-400">
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              {/* Picasso catfish — wiggling */}
              <g transform="translate(170, 80)">
                <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="8" />
                <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="7" />
                <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="8" />
                <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="8" />
                <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="8" />
                <path d="M 25 -46 C 35 -72, 60 -68, 70 -42" strokeWidth="6" />
                <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="8" />
                <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="6" />
                <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="5" />
                <circle cx="-35" cy="-6" r="8" fill="currentColor" stroke="none" />
              </g>
              {/* Shake lines */}
              <path d="M 30 15 L 50 30" strokeWidth="5" opacity="0.5" />
              <path d="M 15 40 L 40 45" strokeWidth="5" opacity="0.5" />
              <path d="M 300 15 L 280 30" strokeWidth="5" opacity="0.5" />
              <path d="M 315 40 L 290 45" strokeWidth="5" opacity="0.5" />
            </svg>
            Shake your phone to split equally!
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const granted = await requestShakePermission();
              if (granted) {
                setShakeEnabled(true);
                toast.success("Shake enabled! Give your phone a good shake ~");
              } else {
                toast.error("Motion access denied — enable in browser settings");
              }
            }}
            className="mt-4 flex items-center justify-center gap-2 self-center rounded-full border border-dashed border-brand-200 px-5 py-2 text-sm font-medium text-brand-400 transition-colors hover:border-brand-400 hover:bg-cream-light hover:text-brand-600"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 340 160" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
              {/* Picasso catfish + shake lines */}
              <g transform="translate(170, 80)">
                <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="8" />
                <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="7" />
                <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="8" />
                <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="8" />
                <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="8" />
                <path d="M 25 -46 C 35 -72, 60 -68, 70 -42" strokeWidth="6" />
                <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="8" />
                <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="6" />
                <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="5" />
                <circle cx="-35" cy="-6" r="8" fill="currentColor" stroke="none" />
              </g>
              <path d="M 30 15 L 50 30" strokeWidth="5" opacity="0.4" />
              <path d="M 15 40 L 40 45" strokeWidth="5" opacity="0.4" />
              <path d="M 300 15 L 280 30" strokeWidth="5" opacity="0.4" />
              <path d="M 315 40 L 290 45" strokeWidth="5" opacity="0.4" />
            </svg>
            Enable shake to split
          </button>
        )
      )}

      {/* Section cards */}
      <div className="mt-6 flex flex-1 flex-col gap-6">
        {sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            isMultiSection={isMultiSection}
            isLocked={isLocked}
            isHost={isHost}
            currentMemberId={currentMemberId}
            members={members}
            onAddItem={(name, unitPrice, quantity) => addItem(name, unitPrice, section.id, quantity)}
            onUpdateItem={(itemId, updates) => updateItem(itemId, section.id, updates)}
            onDeleteItem={(itemId) => deleteItem(itemId, section.id)}
            onBumpMemberShare={(itemId, memberId) => bumpMemberShare(itemId, section.id, memberId)}
            onResetMemberShare={(itemId, memberId) => resetMemberShare(itemId, section.id, memberId)}
            onSelectAll={(itemId) => selectAll(itemId, section.id)}
            onUpdateExtras={(update) => updateExtras(update, section.id)}
            onDeleteSection={() => deleteSection(section.id)}
            onUpdateSectionName={(name) => updateSection(section.id, name)}
            onScanReceipt={(file) => handleScanReceipt(file, section.id)}
            scanPending={scanReceipt.isPending}
            onVoiceResult={(blob) => handleVoiceResult(blob, section.id)}
            voicePending={parseVoice.isPending}
            voiceSupported={voice.isSupported}
            voiceRecording={voice.isRecording && voiceSectionId === section.id}
            voiceDuration={voice.duration}
            onVoiceStart={() => { setVoiceSectionId(section.id); voice.start(); }}
            onVoiceStop={voice.stop}
            voiceAnalyser={voice.analyser}
          />
        ))}

        {/* Add section button (host only, not locked) */}
        {!isLocked && (
          <button
            type="button"
            onClick={() => addSection("")}
            className="self-center rounded-full border border-dashed border-brand-200 px-6 py-2 font-caveat text-base text-brand-400 transition-colors hover:border-brand-400 hover:bg-cream-light hover:text-brand-600"
          >
            + Add Restaurant / Section
          </button>
        )}
      </div>

      {/* Grand total + Finalize */}
      <div className="mt-8 border-t border-brand-200 pt-4">
        {/* Single-section breakdown (same as old UI) */}
        {!isMultiSection && singleExtras && (
          <div className="rounded-xl border border-brand-200 bg-cream-light px-4 py-3">
            <div className="flex items-center justify-between text-sm text-brand-500">
              <span>Subtotal</span>
              <Baht value={singleSubtotal} />
            </div>
            {singleDiscount > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-฿{singleDiscount.toFixed(2)}</span>
              </div>
            )}
            {singleExtras.serviceChargeRate != null && (
              <div className="mt-1 flex items-center justify-between text-sm text-brand-400">
                <span>Service Charge {parseFloat((singleScRate * 100).toFixed(2))}%</span>
                <span>฿{singleServiceCharge.toFixed(2)}</span>
              </div>
            )}
            {singleExtras.vatRate != null && (
              <div className="mt-1 flex items-center justify-between text-sm text-brand-400">
                <span>VAT {parseFloat((singleVRate * 100).toFixed(2))}%</span>
                <span>฿{singleVat.toFixed(2)}</span>
              </div>
            )}
            {(singleExtras.vatRate != null || singleExtras.serviceChargeRate != null || singleExtras.discountAmount != null) && (
              <div className="mt-2 border-t border-brand-100 pt-2" />
            )}
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Total</span>
              <Baht value={grandTotal} className="text-lg font-semibold" />
            </div>
          </div>
        )}

        {/* Multi-section grand total */}
        {isMultiSection && (
          <div className="rounded-xl border border-brand-200 bg-cream-light px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Grand Total</span>
              <Baht value={grandTotal} className="text-lg font-semibold" />
            </div>
            <p className="mt-1 text-xs text-brand-300">
              {sections.length} sections, {totalItems} items
            </p>
          </div>
        )}

        {/* Live split preview per member */}
        {liveSplits.length > 0 && liveSplits.some((s) => s.total > 0) && (
          <div className="mt-3 rounded-xl border border-brand-200 bg-cream-light px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Each person pays
              </p>
              <button
                type="button"
                onClick={() => setShowBreakdown(true)}
                className="flex items-center gap-1 rounded-full border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-400 transition-colors hover:border-brand-300 hover:bg-cream-light hover:text-brand-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Details
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {liveSplits.map((split) => (
                <div key={split.memberId} className="flex items-center justify-between">
                  <span className={`text-sm ${split.memberId === currentMemberId ? "font-semibold" : "text-gray-600"}`}>
                    {split.displayName}
                    {split.isHost && <span className="ml-1 text-xs text-brand-300">(host)</span>}
                    {split.memberId === currentMemberId && <span className="ml-1 text-xs text-brand-300">(you)</span>}
                  </span>
                  <span className={`text-sm tabular-nums ${split.memberId === currentMemberId ? "font-semibold" : "text-gray-600"}`}>
                    {split.total > 0 ? <Baht value={split.total} /> : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isHost ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleFinalize}
              disabled={totalItems === 0 || finalizeRoom.isPending}
              className="rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 md:px-10 md:py-3 md:text-base"
            >
              {finalizeRoom.isPending ? "Calculating..." : "Finish and Set Payment"}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center font-caveat text-base text-brand-400">
            {isLocked
              ? "Host is setting up payment method..."
              : "Waiting for host to finalize..."}
          </p>
        )}
      </div>

      {/* Calculation breakdown modal */}
      {showBreakdown && (
        <BreakdownModal
          onClose={() => setShowBreakdown(false)}
          sectionBreakdowns={sectionBreakdowns}
          members={members}
          currentMemberId={currentMemberId}
          isMultiSection={isMultiSection}
        />
      )}
    </div>
  );
}
