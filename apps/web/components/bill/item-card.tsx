"use client";

import { useState } from "react";
import type { CollabItem } from "@/lib/hooks/use-bill-collab";

export function ItemCard({
  item,
  isLocked,
  isHost,
  currentMemberId,
  members,
  onDelete,
  onUpdate,
  onToggleMember,
  onSelectAll,
}: {
  item: CollabItem;
  isLocked: boolean;
  isHost: boolean;
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  onDelete: () => void;
  onUpdate: (updates: { name?: string; quantity?: number; unitPrice?: number }) => void;
  onToggleMember: (memberId: string) => void;
  onSelectAll: () => void;
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

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      {/* Edit mode — name + qty + price */}
      {editing ? (
        <div>
          <div className="space-y-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Item name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              autoFocus
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={qtyDraft}
                onChange={(e) => setQtyDraft(e.target.value)}
                placeholder="Qty"
                className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm focus:border-gray-500 focus:outline-none"
                min="1"
                step="1"
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              />
              <input
                type="number"
                value={priceDraft}
                onChange={(e) => setPriceDraft(e.target.value)}
                placeholder="Unit price"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
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
              className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-gray-500 hover:text-gray-800"
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
              <p className={`font-medium text-gray-800 ${canEdit ? "group-hover:text-gray-500 transition-colors" : ""}`}>
                {item.name}
                {item.quantity > 1 && <span className="ml-1 text-sm font-normal text-gray-400">(x{item.quantity})</span>}
              </p>
              {canEdit && (
                <svg className="h-3 w-3 shrink-0 text-gray-300 group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )}
            </div>
            <p className="text-sm text-gray-500">
              ฿{totalPrice.toFixed(2)}
              {item.quantity > 1 && <span className="ml-1 text-xs text-gray-400">(฿{item.unitPrice.toFixed(2)} each)</span>}
            </p>
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-2 shrink-0 text-gray-400 transition-colors hover:text-red-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

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
