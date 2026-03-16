"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import { roomQueries } from "@/lib/queries/rooms";
import { useFinalizeRoom, useScanReceipt } from "@/lib/mutations/rooms";
import { useBillCollab } from "@/lib/hooks/use-bill-collab";

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
  const { items, isLocked, extras, addItem, deleteItem, toggleMember, selectAll, updateExtras } = useBillCollab(
    code,
    {
      currentMemberId,
      isHost,
      members,
      onStatusChanged: (status) => {
        if (status === "payment" && !isHost) {
          router.replace(`/quick-split/${code}/tracking`);
        }
      },
    },
  );

  // Finalize mutation — sends everything in one batch
  const finalizeRoom = useFinalizeRoom(roomId);

  // ─── Receipt OCR scan ───
  const scanReceipt = useScanReceipt();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanReceipt = async (file: File) => {
    const toastId = toast.loading("Scanning receipt...");
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
      });
      // Convert to base64
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      const result = await scanReceipt.mutateAsync(base64);
      console.log("[scan-receipt] OCR result:", JSON.stringify(result, null, 2));

      if (result.items.length === 0) {
        toast.error("Couldn't find any items on this receipt", { id: toastId });
        return;
      }

      // Bulk-add items via PartyKit
      for (const item of result.items) {
        addItem(item.name, item.amount);
      }

      // Auto-set VAT, service charge & discount if detected
      if (result.vatRate != null) {
        updateExtras({ vatRate: result.vatRate });
      }
      if (result.serviceChargeRate != null) {
        updateExtras({ serviceChargeRate: result.serviceChargeRate });
      }
      if (result.discountAmount != null) {
        updateExtras({ discountAmount: result.discountAmount });
      }

      toast.success(`Added ${result.items.length} items from receipt`, { id: toastId });
    } catch {
      toast.error("Failed to scan receipt — try again or add items manually", { id: toastId });
    }
  };

  // Add item form state
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  // Subtotal needed early for % discount display
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  // VAT, service charge, discount — synced via PartyKit, local draft for typing UX
  const hasVat = extras.vatRate != null;
  const hasServiceCharge = extras.serviceChargeRate != null;
  const hasDiscount = extras.discountAmount != null;
  const [vatDraft, setVatDraft] = useState<string | null>(null);
  const [scDraft, setScDraft] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<"flat" | "pct">("flat");
  const vatInputRef = useRef<HTMLInputElement>(null);
  const scInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // Display: local draft while focused, otherwise derive from extras
  const vatPct = vatDraft ?? (extras.vatRate != null ? String(parseFloat((extras.vatRate * 100).toFixed(2))) : "7");
  const serviceChargePct = scDraft ?? (extras.serviceChargeRate != null ? String(parseFloat((extras.serviceChargeRate * 100).toFixed(2))) : "10");
  // In % mode, derive display from flat amount + subtotal; in flat mode, show the amount directly
  const discountDisplay = discountDraft ?? (
    extras.discountAmount != null
      ? discountMode === "pct" && subtotal > 0
        ? String(Math.round((extras.discountAmount / subtotal) * 100))
        : String(extras.discountAmount)
      : "0"
  );

  const handleAddItem = () => {
    const amount = parseFloat(itemAmount);
    if (!itemName.trim() || isNaN(amount) || amount <= 0) return;

    addItem(itemName.trim(), amount);
    setItemName("");
    setItemAmount("");
    setShowForm(false);
  };

  const handleFinalize = () => {
    // Validate: every item must have at least 1 person
    const hasEmpty = items.some((item) => item.memberIds.length === 0);
    if (hasEmpty) {
      toast.error("Oops! Every item needs at least one person assigned 🍽️");
      return;
    }

    finalizeRoom.mutate(
      {
        items: items.map((item) => ({
          name: item.name,
          amount: item.amount,
          memberIds: item.memberIds,
        })),
        vatRate: extras.vatRate,
        serviceChargeRate: extras.serviceChargeRate,
        discountAmount: extras.discountAmount,
      },
      {
        onSuccess: () => {
          router.push(`/quick-split/${code}/payment`);
        },
        onError: () => {
          toast.error("Couldn't finalize — try again 😵");
        },
      }
    );
  };

  // Calculate running total: subtotal → -discount → +SC → +VAT (Thai ++ convention)
  const discount = extras.discountAmount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const scRate = extras.serviceChargeRate ?? 0;
  const vRate = extras.vatRate ?? 0;
  const serviceChargeAmount = discountedSubtotal * scRate;
  const vatAmount = (discountedSubtotal + serviceChargeAmount) * vRate;
  const total = discountedSubtotal + serviceChargeAmount + vatAmount;

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
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
          <h1 className="font-heading text-2xl font-bold text-gray-800 md:text-3xl">
            Bill Details
          </h1>
        </div>
        {!isLocked && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleScanReceipt(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={scanReceipt.isPending}
              className="flex items-center gap-1.5 rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {scanReceipt.isPending ? "Scanning..." : "Scan Receipt"}
            </button>
          </>
        )}
      </div>

      {/* Items list (collaborative — synced via WebSocket) */}
      <div className="mt-6 flex flex-1 flex-col gap-4">
        {items.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            No items yet. Tap &quot;Add Item&quot; to start!
          </p>
        )}

        {items.map((item) => {
          // Can edit if not locked (or you're the host — host has already left this page)
          const canEdit = !isLocked;
          const canDelete = canEdit && (item.addedBy === currentMemberId || isHost);

          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    ฿{item.amount.toFixed(2)}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="text-gray-400 transition-colors hover:text-red-500"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Split amongst chips */}
              <div className="mt-2 border-t border-gray-100 pt-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Split Amongst</p>
                  {canEdit && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={item.memberIds.length === members.length}
                        onChange={() => selectAll(item.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-800"
                      />
                      All
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((member) => {
                    const isSelected = item.memberIds.includes(member.id);
                    if (!canEdit) {
                      return (
                        <span
                          key={member.id}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          {member.displayName}
                        </span>
                      );
                    }
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(item.id, member.id)}
                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-gray-800 text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {member.displayName}
                      </button>
                    );
                  })}
                </div>
                {item.memberIds.length === 0 && (
                  <p className="mt-1 text-xs text-red-400">Select at least one person</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Add item form / button — hidden when locked */}
        {isLocked ? null : showForm ? (
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem();
                }}
              />
              <input
                type="number"
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
                placeholder="Amount"
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                min="0"
                step="0.01"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem();
                }}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!itemName.trim() || !itemAmount}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Add Item
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setItemName("");
                  setItemAmount("");
                }}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="self-center rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            Add Item
          </button>
        )}
      </div>

      {/* VAT & Service Charge + Total + Finalize */}
      <div className="mt-8 border-t border-gray-200 pt-4">
        {/* VAT & Service Charge toggles (host only, before finalize) */}
        {!isLocked && (
          <div className="mb-4 space-y-3">
            {/* Service Charge toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasServiceCharge}
                  onChange={() => updateExtras({
                    serviceChargeRate: hasServiceCharge ? null : (parseFloat(serviceChargePct) || 10) / 100,
                  })}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-800"
                />
                <span className="text-sm text-gray-700">Service Charge</span>
              </label>
              {hasServiceCharge && (
                <div className="flex items-center gap-1">
                  <input
                    ref={scInputRef}
                    type="number"
                    value={serviceChargePct}
                    onFocus={() => setScDraft(serviceChargePct)}
                    onChange={(e) => setScDraft(e.target.value)}
                    onBlur={() => { updateExtras({ serviceChargeRate: (parseFloat(serviceChargePct) || 0) / 100 }); setScDraft(null); }}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-gray-500 focus:outline-none"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              )}
            </div>

            {/* VAT toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasVat}
                  onChange={() => updateExtras({
                    vatRate: hasVat ? null : (parseFloat(vatPct) || 7) / 100,
                  })}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-800"
                />
                <span className="text-sm text-gray-700">VAT</span>
              </label>
              {hasVat && (
                <div className="flex items-center gap-1">
                  <input
                    ref={vatInputRef}
                    type="number"
                    value={vatPct}
                    onFocus={() => setVatDraft(vatPct)}
                    onChange={(e) => setVatDraft(e.target.value)}
                    onBlur={() => { updateExtras({ vatRate: (parseFloat(vatPct) || 0) / 100 }); setVatDraft(null); }}
                    className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-gray-500 focus:outline-none"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              )}
            </div>

            {/* Discount toggle */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasDiscount}
                  onChange={() => updateExtras({
                    discountAmount: hasDiscount ? null : 0,
                  })}
                  className="h-4 w-4 rounded border-gray-300 accent-gray-800"
                />
                <span className="text-sm text-gray-700">Discount</span>
              </label>
              {hasDiscount && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setDiscountDraft(null); setDiscountMode(discountMode === "flat" ? "pct" : "flat"); }}
                    className="rounded border border-gray-300 px-1.5 py-0.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                  >
                    {discountMode === "flat" ? "฿" : "%"}
                  </button>
                  <input
                    ref={discountInputRef}
                    type="number"
                    value={discountDisplay}
                    onFocus={() => setDiscountDraft(discountDisplay)}
                    onChange={(e) => setDiscountDraft(e.target.value)}
                    onBlur={() => {
                      const val = parseFloat(discountDisplay) || 0;
                      const flat = discountMode === "pct" ? Math.round(subtotal * val) / 100 : val;
                      updateExtras({ discountAmount: flat });
                      setDiscountDraft(null);
                    }}
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-gray-500 focus:outline-none"
                    min="0"
                    step={discountMode === "pct" ? "1" : "0.01"}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Breakdown */}
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>฿{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-฿{discount.toFixed(2)}</span>
            </div>
          )}
          {hasServiceCharge && (
            <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
              <span>Service Charge {serviceChargePct}%</span>
              <span>฿{serviceChargeAmount.toFixed(2)}</span>
            </div>
          )}
          {hasVat && (
            <div className="mt-1 flex items-center justify-between text-sm text-gray-500">
              <span>VAT {vatPct}%</span>
              <span>฿{vatAmount.toFixed(2)}</span>
            </div>
          )}
          {(hasVat || hasServiceCharge || hasDiscount) && (
            <div className="mt-2 border-t border-gray-100 pt-2" />
          )}
          <div className="flex items-center justify-between">
            <span className="text-lg font-medium text-gray-800">Total</span>
            <span className="text-lg font-semibold text-gray-800">
              ฿{total.toFixed(2)}
            </span>
          </div>
        </div>

        {isHost ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleFinalize}
              disabled={items.length === 0 || finalizeRoom.isPending}
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
    </div>
  );
}
