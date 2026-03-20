"use client";

import { use, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import imageCompression from "browser-image-compression";
import { calculateSplit } from "@pladuk/shared/utils";
import type { MemberSplit } from "@pladuk/shared/utils";
import { roomQueries } from "@/lib/queries/rooms";
import { useFinalizeRoom, useScanReceipt } from "@/lib/mutations/rooms";
import { useBillCollab } from "@/lib/hooks/use-bill-collab";
import type { CollabSection, CollabItem, BillExtras } from "@/lib/hooks/use-bill-collab";

interface SectionBreakdown {
  sectionName: string;
  subtotal: number;
  discountAmount: number;
  serviceChargeAmount: number;
  vatAmount: number;
  sectionTotal: number;
  splits: MemberSplit[];
  roundingDifference: number;
  itemClaimerCounts: Map<string, number>;
}

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
              className="font-heading text-base font-semibold text-gray-800 transition-colors hover:text-gray-500"
            >
              {section.name || "Untitled Section"}
              {!isLocked && (
                <svg className="ml-1 inline h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
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

// ─── Breakdown Modal ───

function BreakdownModal({
  onClose,
  sectionBreakdowns,
  members,
  currentMemberId,
  isMultiSection,
}: {
  onClose: () => void;
  sectionBreakdowns: SectionBreakdown[];
  members: { id: string; displayName: string; isHost?: boolean }[];
  currentMemberId: string;
  isMultiSection: boolean;
}) {
  // Sort members: current user first, then by total descending
  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === currentMemberId) return -1;
    if (b.id === currentMemberId) return 1;
    return 0;
  });

  const fmt = (n: number) => `฿${n.toFixed(2)}`;
  const pct = (n: number) => `${parseFloat((n * 100).toFixed(2))}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative max-h-[85svh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white px-5 pb-8 pt-5 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-gray-800">
            Calculation Breakdown
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          Updates live as the bill changes
        </p>

        {/* Member breakdowns */}
        <div className="mt-4 flex flex-col gap-4">
          {sortedMembers.map((member) => {
            const isCurrentUser = member.id === currentMemberId;

            // Gather this member's splits across all sections
            const memberSections = sectionBreakdowns
              .map((bd) => {
                const split = bd.splits.find((s) => s.memberId === member.id);
                return split ? { breakdown: bd, split } : null;
              })
              .filter((x): x is { breakdown: SectionBreakdown; split: MemberSplit } => x !== null);

            const grandTotal = memberSections.reduce((sum, ms) => sum + ms.split.totalAmount, 0);

            return (
              <div
                key={member.id}
                className={`rounded-xl border p-4 ${
                  isCurrentUser
                    ? "border-gray-800 bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                {/* Member name header */}
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-sm font-semibold text-gray-800">
                    {member.displayName}
                  </h3>
                  {member.isHost && (
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">host</span>
                  )}
                  {isCurrentUser && (
                    <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium text-white">you</span>
                  )}
                </div>

                {memberSections.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">No items assigned</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {memberSections.map(({ breakdown: bd, split }, si) => (
                      <div key={si}>
                        {/* Section name (multi-section only) */}
                        {isMultiSection && (
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                            {bd.sectionName}
                          </p>
                        )}

                        {/* Items */}
                        <div className="space-y-1">
                          {split.items.map((item) => {
                            const claimerCount = bd.itemClaimerCounts.get(item.itemId) ?? 1;
                            return (
                              <div key={item.itemId} className="flex items-baseline justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs text-gray-700">{item.name}</span>
                                  <span className="ml-1 text-[10px] text-gray-400">
                                    {claimerCount === 1 ? "(only you)" : `(÷${claimerCount})`}
                                  </span>
                                </div>
                                <div className="shrink-0 text-right">
                                  {claimerCount > 1 && (
                                    <span className="text-[10px] tabular-nums text-gray-400">
                                      {fmt(item.shareAmount * claimerCount)} ÷ {claimerCount} ={" "}
                                    </span>
                                  )}
                                  <span className="text-xs tabular-nums font-medium text-gray-700">
                                    {fmt(item.shareAmount)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Items subtotal */}
                        <div className="mt-1.5 flex items-center justify-between border-t border-dashed border-gray-200 pt-1.5">
                          <span className="text-[10px] text-gray-400">Items subtotal</span>
                          <span className="text-xs tabular-nums font-medium text-gray-700">{fmt(split.itemsSubtotal)}</span>
                        </div>

                        {/* Proportion */}
                        {bd.subtotal > 0 && (
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">Your proportion</span>
                            <span className="text-[10px] tabular-nums text-gray-400">
                              {fmt(split.itemsSubtotal)} / {fmt(bd.subtotal)} = {pct(split.proportion)}
                            </span>
                          </div>
                        )}

                        {/* Extras */}
                        {(split.discountShare > 0 || split.serviceChargeShare > 0 || split.vatShare > 0) && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Extras</p>
                            {split.discountShare > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">
                                  Discount: {fmt(bd.discountAmount)} × {pct(split.proportion)}
                                </span>
                                <span className="text-xs tabular-nums font-medium text-green-600">
                                  -{fmt(split.discountShare)}
                                </span>
                              </div>
                            )}
                            {split.serviceChargeShare > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">
                                  SC: {fmt(bd.serviceChargeAmount)} × {pct(split.proportion)}
                                </span>
                                <span className="text-xs tabular-nums font-medium text-gray-500">
                                  +{fmt(split.serviceChargeShare)}
                                </span>
                              </div>
                            )}
                            {split.vatShare > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400">
                                  VAT: {fmt(bd.vatAmount)} × {pct(split.proportion)}
                                </span>
                                <span className="text-xs tabular-nums font-medium text-gray-500">
                                  +{fmt(split.vatShare)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section total (multi-section) */}
                        {isMultiSection && (
                          <div className="mt-1.5 flex items-center justify-between border-t border-gray-200 pt-1.5">
                            <span className="text-xs text-gray-600">Section total</span>
                            <span className="text-xs tabular-nums font-semibold text-gray-800">{fmt(split.totalAmount)}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Grand total */}
                    <div className={`flex items-center justify-between ${isMultiSection ? "border-t-2 border-gray-800 pt-2" : "border-t border-gray-200 pt-1.5"}`}>
                      <span className="text-sm font-medium text-gray-800">Total</span>
                      <span className="text-sm tabular-nums font-bold text-gray-800">{fmt(grandTotal)}</span>
                    </div>

                    {/* Rounding note for last person */}
                    {memberSections.some(({ breakdown: bd }) => {
                      const lastSplit = bd.splits[bd.splits.length - 1];
                      return lastSplit?.memberId === member.id && Math.abs(bd.roundingDifference) >= 0.005;
                    }) && (
                      <p className="text-[10px] text-gray-400">
                        * Includes rounding adjustment (±฿0.01)
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
