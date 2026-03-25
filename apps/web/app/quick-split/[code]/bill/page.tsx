"use client";

import { use, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import { calculateSplit } from "@pladuk/shared/utils";
import { roomQueries } from "@/lib/queries/rooms";
import { useFinalizeRoom, useScanReceipt, useParseVoice } from "@/lib/mutations/rooms";
import { useBillCollab } from "@/lib/hooks/use-bill-collab";
import { useVoiceInput } from "@/lib/hooks/use-voice-input";
import { usePresence } from "@/lib/hooks/use-presence";
import { SectionCard } from "@/components/bill/section-card";
import { BreakdownModal } from "@/components/bill/breakdown-modal";
import { LiveCursors } from "@/components/bill/live-cursors";
import { PresenceAvatars } from "@/components/bill/presence-avatars";
import { useShake } from "@/lib/hooks/use-shake";
import type { SectionBreakdown } from "@/components/bill/breakdown-modal";

// ─── Main Page ───

export default function BillDetailsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

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
    toggleMember,
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
        item.memberIds.map((mId) => ({
          billItemId: item.id,
          memberId: mId,
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

      // Build item claimer counts for breakdown modal
      const itemClaimerCounts = new Map<string, number>();
      for (const item of assignedItems) {
        itemClaimerCounts.set(item.id, item.memberIds.length);
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
        itemClaimerCounts,
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

  const handleFinalize = () => {
    // Validate: every item in every section must have at least 1 person
    for (const sec of sections) {
      const hasEmpty = sec.items.some((item) => item.memberIds.length === 0);
      if (hasEmpty) {
        toast.error(`Every item needs at least one person assigned${isMultiSection && sec.name ? ` (${sec.name})` : ""} 🍽️`);
        return;
      }
    }

    if (isMultiSection) {
      // Send as sections
      finalizeRoom.mutate(
        {
          sections: sections.map((sec) => ({
            name: sec.name || "Untitled",
            items: sec.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              memberIds: item.memberIds,
            })),
            vatRate: sec.extras.vatRate,
            serviceChargeRate: sec.extras.serviceChargeRate,
            discountAmount: sec.extras.discountAmount,
          })),
        },
        {
          onSuccess: () => router.push(`/quick-split/${code}/payment`),
          onError: () => toast.error("Couldn't finalize — try again 😵"),
        },
      );
    } else {
      // Single section: send as legacy flat format
      const sec = sections[0];
      if (!sec) return;
      finalizeRoom.mutate(
        {
          items: sec.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            memberIds: item.memberIds,
          })),
          vatRate: sec.extras.vatRate,
          serviceChargeRate: sec.extras.serviceChargeRate,
          discountAmount: sec.extras.discountAmount,
        },
        {
          onSuccess: () => router.push(`/quick-split/${code}/payment`),
          onError: () => toast.error("Couldn't finalize — try again 😵"),
        },
      );
    }
  };

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
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
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-gray-800 md:text-3xl">
              Bill Details
            </h1>
            <PresenceAvatars onlineUsers={onlineUsers} members={members} currentMemberId={currentMemberId} />
          </div>
        </div>
        {/* Scan receipt button — only for single-section mode */}
        {!isLocked && !isMultiSection && (
          <>
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
              className="flex items-center gap-1.5 rounded-full border border-gray-300 px-2.5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 md:px-3 md:py-1.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden md:inline">{scanReceipt.isPending ? "Scanning..." : "Scan Receipt"}</span>
            </button>
          </>
        )}
        {!isLocked && !isMultiSection && voice.isSupported && (
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
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 md:px-3 md:py-1.5 ${
              voice.isRecording
                ? "border-red-300 bg-red-50 text-red-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
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

      {/* Voice recording indicator */}
      {voice.isRecording && (
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-red-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Recording... Speak your order, then tap Stop
        </div>
      )}

      {/* Shake to split — mobile only */}
      {!isLocked && shakeSupported && totalItems > 0 && (
        shakeEnabled ? (
          <p className="mt-4 text-center text-xs text-gray-400">
            📱 Shake your phone to split equally!
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              const granted = await requestShakePermission();
              if (granted) {
                setShakeEnabled(true);
                toast.success("Shake enabled! Give your phone a good shake 📱");
              } else {
                toast.error("Motion access denied — enable in browser settings");
              }
            }}
            className="mt-4 flex items-center justify-center gap-2 self-center rounded-full border border-dashed border-gray-300 px-5 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            <span className="text-base">📱</span>
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
            onToggleMember={(itemId, memberId) => toggleMember(itemId, section.id, memberId)}
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
          />
        ))}

        {/* Add section button (host only, not locked) */}
        {!isLocked && (
          <button
            type="button"
            onClick={() => addSection("")}
            className="self-center rounded-full border border-dashed border-gray-300 px-6 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50 hover:text-gray-700"
          >
            + Add Restaurant / Section
          </button>
        )}
      </div>

      {/* Grand total + Finalize */}
      <div className="mt-8 border-t border-gray-200 pt-4">
        {/* Single-section breakdown (same as old UI) */}
        {!isMultiSection && singleExtras && (
          <div className="rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>฿{singleSubtotal.toFixed(2)}</span>
            </div>
            {singleDiscount > 0 && (
              <div className="mt-1 flex items-center justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-฿{singleDiscount.toFixed(2)}</span>
              </div>
            )}
            {singleExtras.serviceChargeRate != null && (
              <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
                <span>Service Charge {parseFloat((singleScRate * 100).toFixed(2))}%</span>
                <span>฿{singleServiceCharge.toFixed(2)}</span>
              </div>
            )}
            {singleExtras.vatRate != null && (
              <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
                <span>VAT {parseFloat((singleVRate * 100).toFixed(2))}%</span>
                <span>฿{singleVat.toFixed(2)}</span>
              </div>
            )}
            {(singleExtras.vatRate != null || singleExtras.serviceChargeRate != null || singleExtras.discountAmount != null) && (
              <div className="mt-2 border-t border-gray-100 pt-2" />
            )}
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-gray-800">Total</span>
              <span className="text-lg font-semibold text-gray-800">
                ฿{grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Multi-section grand total */}
        {isMultiSection && (
          <div className="rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium text-gray-800">Grand Total</span>
              <span className="text-lg font-semibold text-gray-800">
                ฿{grandTotal.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {sections.length} sections, {totalItems} items
            </p>
          </div>
        )}

        {/* Live split preview per member */}
        {liveSplits.length > 0 && liveSplits.some((s) => s.total > 0) && (
          <div className="mt-3 rounded-lg border border-gray-200 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Each person pays
              </p>
              <button
                type="button"
                onClick={() => setShowBreakdown(true)}
                className="flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-400 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600"
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
                  <span className={`text-sm ${split.memberId === currentMemberId ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                    {split.displayName}
                    {split.isHost && <span className="ml-1 text-xs text-gray-400">(host)</span>}
                    {split.memberId === currentMemberId && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                  </span>
                  <span className={`text-sm tabular-nums ${split.memberId === currentMemberId ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                    {split.total > 0 ? `฿${split.total.toFixed(2)}` : "—"}
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
              className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 md:px-10 md:py-3 md:text-base"
            >
              {finalizeRoom.isPending ? "Calculating..." : "Finish and Set Payment"}
            </button>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-gray-400">
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
