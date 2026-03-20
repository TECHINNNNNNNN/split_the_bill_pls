"use client";

import { use, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import { calculateSplit } from "@pladuk/shared/utils";
import { roomQueries } from "@/lib/queries/rooms";
import { useFinalizeRoom, useScanReceipt } from "@/lib/mutations/rooms";
import { useBillCollab } from "@/lib/hooks/use-bill-collab";
import type { CollabSection, CollabItem, BillExtras } from "@/lib/hooks/use-bill-collab";

// ─── Section Card Component ───

function SectionCard({
  section,
  isMultiSection,
  isLocked,
  isHost,
  currentMemberId,
  members,
  onAddItem,
  onDeleteItem,
  onToggleMember,
  onSelectAll,
  onUpdateExtras,
  onDeleteSection,
  onUpdateSectionName,
  onScanReceipt,
  scanPending,
}: {
  section: CollabSection;
  isMultiSection: boolean;
  isLocked: boolean;
  isHost: boolean;
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  onAddItem: (name: string, amount: number) => void;
  onDeleteItem: (itemId: string) => void;
  onToggleMember: (itemId: string, memberId: string) => void;
  onSelectAll: (itemId: string) => void;
  onUpdateExtras: (update: Partial<BillExtras>) => void;
  onDeleteSection: () => void;
  onUpdateSectionName: (name: string) => void;
  onScanReceipt: (file: File) => void;
  scanPending: boolean;
}) {
  // Per-section form state
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  // Per-section extras draft state
  const [vatDraft, setVatDraft] = useState<string | null>(null);
  const [scDraft, setScDraft] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<"flat" | "pct">("flat");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(section.name);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { extras, items } = section;
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  const hasVat = extras.vatRate != null;
  const hasServiceCharge = extras.serviceChargeRate != null;
  const hasDiscount = extras.discountAmount != null;

  const vatPct = vatDraft ?? (extras.vatRate != null ? String(parseFloat((extras.vatRate * 100).toFixed(2))) : "7");
  const serviceChargePct = scDraft ?? (extras.serviceChargeRate != null ? String(parseFloat((extras.serviceChargeRate * 100).toFixed(2))) : "10");
  const discountDisplay = discountDraft ?? (
    extras.discountAmount != null
      ? discountMode === "pct" && subtotal > 0
        ? String(Math.round((extras.discountAmount / subtotal) * 100))
        : String(extras.discountAmount)
      : "0"
  );

  // Thai ++ calculation
  const discount = extras.discountAmount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const scRate = extras.serviceChargeRate ?? 0;
  const vRate = extras.vatRate ?? 0;
  const serviceChargeAmount = discountedSubtotal * scRate;
  const vatAmount = (discountedSubtotal + serviceChargeAmount) * vRate;
  const sectionTotal = discountedSubtotal + serviceChargeAmount + vatAmount;

  const handleAddItem = () => {
    const amount = parseFloat(itemAmount);
    if (!itemName.trim() || isNaN(amount) || amount <= 0) return;
    onAddItem(itemName.trim(), amount);
    setItemName("");
    setItemAmount("");
    setShowForm(false);
  };

  return (
    <div className={isMultiSection ? "rounded-xl border border-gray-200 bg-white p-4 shadow-sm" : ""}>
      {/* Section header (multi-section only) */}
      {isMultiSection && (
        <div className="mb-3 flex items-center justify-between">
          {!isLocked && editingName ? (
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                onUpdateSectionName(nameDraft.trim());
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdateSectionName(nameDraft.trim());
                  setEditingName(false);
                }
              }}
              placeholder="Section name"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-800 focus:border-gray-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => { if (!isLocked) { setNameDraft(section.name); setEditingName(true); } }}
              className="font-heading text-base font-semibold text-gray-800"
            >
              {section.name || "Untitled Section"}
            </button>
          )}
          <div className="flex items-center gap-2">
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
                    if (file) onScanReceipt(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanPending}
                  className="flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Scan
                </button>
              </>
            )}
            {!isLocked && (
              <button
                type="button"
                onClick={onDeleteSection}
                className="text-gray-400 transition-colors hover:text-red-500"
                title="Remove section"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            {isMultiSection ? "No items yet. Add items or scan a receipt." : "No items yet. Tap \"Add Item\" to start!"}
          </p>
        )}

        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isLocked={isLocked}
            isHost={isHost}
            currentMemberId={currentMemberId}
            members={members}
            onDelete={() => onDeleteItem(item.id)}
            onToggleMember={(memberId) => onToggleMember(item.id, memberId)}
            onSelectAll={() => onSelectAll(item.id)}
          />
        ))}

        {/* Add item form / button */}
        {isLocked ? null : showForm ? (
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
              />
              <input
                type="number"
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
                placeholder="Amount"
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                min="0"
                step="0.01"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
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
                onClick={() => { setShowForm(false); setItemName(""); setItemAmount(""); }}
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

      {/* Extras toggles */}
      {!isLocked && (
        <div className={`${isMultiSection ? "mt-4 border-t border-gray-100 pt-3" : "mt-6 border-t border-gray-200 pt-4"} space-y-3`}>
          {/* Service Charge */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasServiceCharge}
                onChange={() => onUpdateExtras({
                  serviceChargeRate: hasServiceCharge ? null : (parseFloat(serviceChargePct) || 10) / 100,
                })}
                className="h-4 w-4 rounded border-gray-300 accent-gray-800"
              />
              <span className="text-sm text-gray-700">Service Charge</span>
            </label>
            {hasServiceCharge && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={serviceChargePct}
                  onFocus={() => setScDraft(serviceChargePct)}
                  onChange={(e) => setScDraft(e.target.value)}
                  onBlur={() => { onUpdateExtras({ serviceChargeRate: (parseFloat(serviceChargePct) || 0) / 100 }); setScDraft(null); }}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-gray-500 focus:outline-none"
                  min="0" max="100" step="0.01"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          {/* VAT */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasVat}
                onChange={() => onUpdateExtras({
                  vatRate: hasVat ? null : (parseFloat(vatPct) || 7) / 100,
                })}
                className="h-4 w-4 rounded border-gray-300 accent-gray-800"
              />
              <span className="text-sm text-gray-700">VAT</span>
            </label>
            {hasVat && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={vatPct}
                  onFocus={() => setVatDraft(vatPct)}
                  onChange={(e) => setVatDraft(e.target.value)}
                  onBlur={() => { onUpdateExtras({ vatRate: (parseFloat(vatPct) || 0) / 100 }); setVatDraft(null); }}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-gray-500 focus:outline-none"
                  min="0" max="100" step="0.01"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            )}
          </div>

          {/* Discount */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasDiscount}
                onChange={() => onUpdateExtras({ discountAmount: hasDiscount ? null : 0 })}
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
                  type="number"
                  value={discountDisplay}
                  onFocus={() => setDiscountDraft(discountDisplay)}
                  onChange={(e) => setDiscountDraft(e.target.value)}
                  onBlur={() => {
                    const val = parseFloat(discountDisplay) || 0;
                    const flat = discountMode === "pct" ? Math.round(subtotal * val) / 100 : val;
                    onUpdateExtras({ discountAmount: flat });
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

      {/* Section subtotal (always shown for multi-section, integrated in grand total for single) */}
      {isMultiSection && (
        <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>฿{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-green-600">
              <span>Discount</span>
              <span>-฿{discount.toFixed(2)}</span>
            </div>
          )}
          {hasServiceCharge && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500">
              <span>SC {serviceChargePct}%</span>
              <span>฿{serviceChargeAmount.toFixed(2)}</span>
            </div>
          )}
          {hasVat && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-gray-500">
              <span>VAT {vatPct}%</span>
              <span>฿{vatAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1">
            <span className="text-sm font-medium text-gray-800">Section Total</span>
            <span className="text-sm font-semibold text-gray-800">฿{sectionTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item Card Component ───

function ItemCard({
  item,
  isLocked,
  isHost,
  currentMemberId,
  members,
  onDelete,
  onToggleMember,
  onSelectAll,
}: {
  item: CollabItem;
  isLocked: boolean;
  isHost: boolean;
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  onDelete: () => void;
  onToggleMember: (memberId: string) => void;
  onSelectAll: () => void;
}) {
  const canEdit = !isLocked;
  const canDelete = canEdit && (item.addedBy === currentMemberId || isHost);

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-800">{item.name}</p>
          <p className="text-sm text-gray-500">฿{item.amount.toFixed(2)}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
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
                onChange={onSelectAll}
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
                onClick={() => onToggleMember(member.id)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-400"
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
}

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
    sections,
    isLocked,
    addSection,
    updateSection,
    deleteSection,
    addItem,
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
        addItem(item.name, item.amount, sectionId);
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

  const isMultiSection = sections.length > 1;

  // Grand total across all sections
  const grandTotal = sections.reduce((total, sec) => {
    const subtotal = sec.items.reduce((sum, item) => sum + item.amount, 0);
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
  const liveSplits = useMemo(() => {
    if (totalItems === 0 || members.length === 0) return [];

    const memberTotalMap = new Map<string, number>();

    for (const sec of sections) {
      if (sec.items.length === 0) continue;

      // Only include items that have at least one member assigned
      const assignedItems = sec.items.filter((item) => item.memberIds.length > 0);
      if (assignedItems.length === 0) continue;

      const calcItems = assignedItems.map((item) => ({
        id: item.id,
        name: item.name,
        totalPrice: item.amount,
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
      for (const split of result.splits) {
        memberTotalMap.set(
          split.memberId,
          (memberTotalMap.get(split.memberId) || 0) + split.totalAmount,
        );
      }
    }

    return members
      .map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        isHost: (m as { isHost?: boolean }).isHost ?? false,
        total: memberTotalMap.get(m.id) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
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
              amount: item.amount,
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
            amount: item.amount,
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
  const singleSubtotal = singleSection?.items.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const singleDiscount = singleExtras?.discountAmount ?? 0;
  const singleDiscountedSubtotal = Math.max(0, singleSubtotal - singleDiscount);
  const singleScRate = singleExtras?.serviceChargeRate ?? 0;
  const singleVRate = singleExtras?.vatRate ?? 0;
  const singleServiceCharge = singleDiscountedSubtotal * singleScRate;
  const singleVat = (singleDiscountedSubtotal + singleServiceCharge) * singleVRate;

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
        {/* Scan receipt button — only for single-section mode */}
        {!isLocked && !isMultiSection && (
          <>
            <input
              ref={singleSectionFileRef}
              type="file"
              accept="image/*"
              capture="environment"
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
            onAddItem={(name, amount) => addItem(name, amount, section.id)}
            onDeleteItem={(itemId) => deleteItem(itemId, section.id)}
            onToggleMember={(itemId, memberId) => toggleMember(itemId, section.id, memberId)}
            onSelectAll={(itemId) => selectAll(itemId, section.id)}
            onUpdateExtras={(update) => updateExtras(update, section.id)}
            onDeleteSection={() => deleteSection(section.id)}
            onUpdateSectionName={(name) => updateSection(section.id, name)}
            onScanReceipt={(file) => handleScanReceipt(file, section.id)}
            scanPending={scanReceipt.isPending}
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
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Each person pays
            </p>
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
    </div>
  );
}
