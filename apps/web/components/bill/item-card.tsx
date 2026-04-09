"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { CollabItem } from "@/lib/hooks/use-bill-collab";

const LONG_PRESS_MS = 400;

export function ItemCard({
  item,
  isLocked,
  isHost,
  currentMemberId,
  members,
  onDelete,
  onUpdate,
  onBumpMemberShare,
  onResetMemberShare,
  onSelectAll,
  waterfallIndex = -1,
  isNew = false,
}: {
  item: CollabItem;
  isLocked: boolean;
  isHost: boolean;
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  onDelete: () => void;
  onUpdate: (updates: { name?: string; quantity?: number; unitPrice?: number }) => void;
  onBumpMemberShare: (memberId: string) => void;
  onResetMemberShare: (memberId: string) => void;
  onSelectAll: () => void;
  waterfallIndex?: number;
}) {
  const canEdit = !isLocked;
  const canDelete = canEdit && (item.addedBy === currentMemberId || isHost);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name);
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity));
  const [priceDraft, setPriceDraft] = useState(String(item.unitPrice));

  const totalPrice = item.quantity * item.unitPrice;

  const startEditing = () => {
    if (!canEdit) return;
    setNameDraft(item.name);
    setQtyDraft(String(item.quantity));
    setPriceDraft(String(item.unitPrice));
    setEditing(true);
  };

  const save = () => {
    const trimmedName = nameDraft.trim();
    const parsedQty = parseInt(qtyDraft);
    const parsedPrice = parseFloat(priceDraft);
    const updates: { name?: string; quantity?: number; unitPrice?: number } = {};
    if (trimmedName && trimmedName !== item.name) updates.name = trimmedName;
    if (!isNaN(parsedQty) && parsedQty >= 1 && parsedQty !== item.quantity) updates.quantity = parsedQty;
    if (!isNaN(parsedPrice) && parsedPrice > 0 && parsedPrice !== item.unitPrice) updates.unitPrice = parsedPrice;
    if (Object.keys(updates).length > 0) onUpdate(updates);
    setEditing(false);
  };

  // Long-press support for resetting a member's share
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = useCallback(
    (memberId: string) => {
      if (!canEdit) return;
      didLongPress.current = false;
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        onResetMemberShare(memberId);
      }, LONG_PRESS_MS);
    },
    [canEdit, onResetMemberShare],
  );

  const handlePointerUpOrLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleChipClick = useCallback(
    (memberId: string) => {
      if (!canEdit) return;
      if (didLongPress.current) {
        didLongPress.current = false;
        return; // suppress click after long-press
      }
      onBumpMemberShare(memberId);
    },
    [canEdit, onBumpMemberShare],
  );

  // Derived: are all members selected with share=1? (for "Everyone" collapse)
  const shares = item.memberShares ?? {};
  const selectedIds = Object.keys(shares);
  const allEqualOne = selectedIds.length === members.length && selectedIds.every((id) => shares[id] === 1);
  const [expanded, setExpanded] = useState(false);
  const showCollapsed = allEqualOne && members.length > 3 && !expanded;

  // First-time inline hint: "tap a name again for ×2 share"
  const HINT_KEY = "pladuk_share_hint_shown";
  const hintEligible = (() => {
    if (typeof window === "undefined") return false;
    try { return !localStorage.getItem(HINT_KEY); } catch { return false; }
  })();
  // Only show when hint hasn't been dismissed AND at least one chip is selected
  const hintVisible = hintEligible && canEdit && selectedIds.length > 0;
  const [hintDismissed, setHintDismissed] = useState(false);

  const dismissHint = useCallback(() => {
    setHintDismissed(true);
    try { localStorage.setItem(HINT_KEY, "1"); } catch {}
  }, []);

  // Auto-dismiss 8 seconds after first becoming visible
  const hintTimerStarted = useRef(false);
  useEffect(() => {
    if (!hintVisible || hintDismissed || hintTimerStarted.current) return;
    hintTimerStarted.current = true;
    const timer = setTimeout(dismissHint, 8000);
    return () => clearTimeout(timer);
  }, [hintVisible, hintDismissed, dismissHint]);

  const showHint = hintVisible && !hintDismissed;

  return (
    <div
      className={`rounded-xl border border-brand-200 bg-cream-light p-3 transition-shadow hover:shadow-sm ${waterfallIndex >= 0 ? "animate-item-waterfall" : "animate-item-fade"}`}
      style={waterfallIndex >= 0 ? { animationDelay: `${waterfallIndex * 120}ms` } : undefined}
    >
      {/* Edit mode */}
      {editing ? (
        <div>
          <div className="space-y-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Item name"
              className="w-full rounded-xl border border-brand-200 bg-cream px-3 py-2 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={qtyDraft}
                onChange={(e) => setQtyDraft(e.target.value)}
                placeholder="Qty"
                className="w-20 rounded-xl border border-brand-200 bg-cream px-2 py-2 text-center text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
                min="1"
                step="1"
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              />
              <input
                type="number"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                placeholder="Unit price"
                className="flex-1 rounded-xl border border-brand-200 bg-cream px-3 py-2 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
                min="0"
                step="0.01"
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              />
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-brand-700 px-4 py-1.5 text-sm font-medium text-cream-light disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-brand-400 hover:text-brand-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Display mode */
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={startEditing}
            className={`min-w-0 flex-1 text-left ${canEdit ? "group" : ""}`}
          >
            <div className="flex items-center gap-1.5">
              <p className={`font-medium ${canEdit ? "transition-colors group-hover:text-brand-500" : ""}`}>
                {item.name}
                {item.quantity > 1 && <span className="ml-1 text-sm font-normal text-brand-300">(x{item.quantity})</span>}
              </p>
              {canEdit && (
                <svg className="h-3 w-3 shrink-0 text-brand-200 transition-colors group-hover:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
            <p className="text-sm text-brand-400">
              ฿{totalPrice.toFixed(2)}
              {item.quantity > 1 && <span className="ml-1 text-xs text-brand-300">(฿{item.unitPrice.toFixed(2)} each)</span>}
            </p>
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-2 shrink-0 text-brand-300 transition-colors hover:text-error"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Split amongst chips */}
      <div className="mt-2 border-t border-brand-100 pt-2">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs text-brand-400">Split Amongst</p>
          {canEdit && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-brand-300">
              <input
                type="checkbox"
                checked={selectedIds.length === members.length}
                onChange={onSelectAll}
                className="h-3.5 w-3.5 rounded border-brand-300 accent-brand-700"
              />
              All
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {showCollapsed ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="rounded-lg bg-brand-700 px-2.5 py-1 text-xs font-medium text-cream-light"
            >
              Everyone ({members.length})
            </button>
          ) : (
            members.map((member) => {
              const share = shares[member.id];
              const isSelected = share != null;
              const label = isSelected && share > 1
                ? `${member.displayName} ×${share}`
                : member.displayName;

              if (!canEdit) {
                return (
                  <span
                    key={member.id}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      isSelected ? "bg-brand-700 text-cream-light" : "bg-brand-50 text-brand-300"
                    }`}
                    aria-label={`${member.displayName}, ${share ?? 0} share${share === 1 ? "" : "s"}`}
                  >
                    {label}
                  </span>
                );
              }
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => { handleChipClick(member.id); if (isSelected) dismissHint(); }}
                  onPointerDown={() => handlePointerDown(member.id)}
                  onPointerUp={handlePointerUpOrLeave}
                  onPointerLeave={handlePointerUpOrLeave}
                  onPointerCancel={handlePointerUpOrLeave}
                  className={`select-none rounded-lg px-2.5 py-1 text-xs font-medium transition-colors active:scale-95 ${
                    isSelected ? "bg-brand-700 text-cream-light" : "bg-brand-50 text-brand-300 hover:bg-brand-100"
                  }`}
                  aria-label={`${member.displayName}, ${share ?? 0} share${share === 1 ? "" : "s"}`}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
        {showHint && canEdit && selectedIds.length > 0 && (
          <p className="mt-1.5 text-[11px] text-brand-300 transition-opacity duration-500">
            tap a name again for ×2 share · hold to remove
          </p>
        )}
        {selectedIds.length === 0 && (
          <p className="mt-1 text-xs text-error">Select at least one person</p>
        )}
      </div>
    </div>
  );
}
