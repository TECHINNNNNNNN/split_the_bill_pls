"use client";

import { useRef, useState } from "react";
import type { CollabSection, BillExtras } from "@/lib/hooks/use-bill-collab";
import { ItemCard } from "./item-card";
import { VoiceWaveform } from "@/components/voice-waveform";

export function SectionCard({
  section,
  isMultiSection,
  isLocked,
  isHost,
  currentMemberId,
  members,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onBumpMemberShare,
  onResetMemberShare,
  onSelectAll,
  onUpdateExtras,
  onDeleteSection,
  onUpdateSectionName,
  onScanReceipt,
  scanPending,
  onVoiceResult,
  voicePending,
  voiceSupported,
  voiceRecording,
  voiceDuration,
  onVoiceStart,
  onVoiceStop,
  voiceAnalyser,
}: {
  section: CollabSection;
  isMultiSection: boolean;
  isLocked: boolean;
  isHost: boolean;
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  onAddItem: (name: string, unitPrice: number, quantity?: number) => void;
  onUpdateItem: (itemId: string, updates: { name?: string; quantity?: number; unitPrice?: number }) => void;
  onDeleteItem: (itemId: string) => void;
  onBumpMemberShare: (itemId: string, memberId: string) => void;
  onResetMemberShare: (itemId: string, memberId: string) => void;
  onSelectAll: (itemId: string) => void;
  onUpdateExtras: (update: Partial<BillExtras>) => void;
  onDeleteSection: () => void;
  onUpdateSectionName: (name: string) => void;
  onScanReceipt: (file: File) => void;
  scanPending: boolean;
  onVoiceResult: (audioBlob: Blob) => void;
  voicePending: boolean;
  voiceSupported: boolean;
  voiceRecording: boolean;
  voiceDuration: number;
  onVoiceStart: () => void;
  onVoiceStop: () => Promise<Blob>;
  voiceAnalyser: React.RefObject<AnalyserNode | null>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemAmount, setItemAmount] = useState("");

  const [vatDraft, setVatDraft] = useState<string | null>(null);
  const [scDraft, setScDraft] = useState<string | null>(null);
  const [discountDraft, setDiscountDraft] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<"flat" | "pct">("flat");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(section.name);

  const fileInputRef = useRef<HTMLInputElement>(null);


  const { extras, items } = section;
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

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

  const discount = extras.discountAmount ?? 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const scRate = extras.serviceChargeRate ?? 0;
  const vRate = extras.vatRate ?? 0;
  const serviceChargeAmount = discountedSubtotal * scRate;
  const vatAmount = (discountedSubtotal + serviceChargeAmount) * vRate;
  const sectionTotal = discountedSubtotal + serviceChargeAmount + vatAmount;

  const handleAddItem = () => {
    const price = parseFloat(itemAmount);
    const qty = parseInt(itemQty) || 1;
    if (!itemName.trim() || isNaN(price) || price <= 0) return;
    onAddItem(itemName.trim(), price, qty);
    setItemName("");
    setItemQty("1");
    setItemAmount("");
    setShowForm(false);
  };

  return (
    <div className={isMultiSection ? "rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm" : ""}>
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
              className="flex-1 rounded-xl border border-brand-200 bg-cream px-2 py-1 text-sm font-semibold placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => { if (!isLocked) { setNameDraft(section.name); setEditingName(true); } }}
              className="font-caveat text-lg font-semibold transition-colors hover:text-brand-500"
            >
              {section.name || "Untitled Section"}
              {!isLocked && (
                <svg className="ml-1 inline h-3.5 w-3.5 text-brand-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="flex items-center gap-1 rounded-full border border-brand-200 px-2.5 py-1 text-xs font-medium text-brand-500 transition-colors hover:bg-cream disabled:opacity-40"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Scan
                </button>
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (voiceRecording) {
                        const blob = await onVoiceStop();
                        onVoiceResult(blob);
                      } else {
                        onVoiceStart();
                      }
                    }}
                    disabled={voicePending}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                      voiceRecording
                        ? "border-[#D4A5A5] bg-[#faf0f0] text-[#c75450]"
                        : "border-brand-200 text-brand-500 hover:bg-cream"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z" />
                    </svg>
                    {voicePending ? "..." : voiceRecording ? `${voiceDuration}s` : "Voice"}
                  </button>
                )}
              </>
            )}
            {!isLocked && (
              <button
                type="button"
                onClick={onDeleteSection}
                className="text-brand-300 transition-colors hover:text-error"
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

      {/* Voice waveform — shown when this section is recording */}
      {voiceRecording && (
        <VoiceWaveform analyser={voiceAnalyser} duration={voiceDuration} />
      )}

      {/* Items list */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-center font-caveat text-base text-brand-300">
            {isMultiSection ? "No items yet. Add items or scan a receipt." : "No items yet. Tap \"Add Item\" to start!"}
          </p>
        )}

        {items.map((item) => {
          return (
            <ItemCard
              key={item.id}
              item={item}
              isLocked={isLocked}
              isHost={isHost}
              currentMemberId={currentMemberId}
              members={members}
              onDelete={() => onDeleteItem(item.id)}
              onUpdate={(updates) => onUpdateItem(item.id, updates)}
              onToggleMember={(memberId) => onToggleMember(item.id, memberId)}
              onSelectAll={() => onSelectAll(item.id)}
              waterfallIndex={-1}
            />
          );
        })}

        {/* Add item form / button */}
        {isLocked ? null : showForm ? (
          <div className="rounded-xl border border-brand-200 bg-cream p-3">
            <div className="space-y-2">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
                className="w-full rounded-xl border border-brand-200 bg-cream-light px-3 py-2 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
                onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  placeholder="Qty"
                  className="w-20 rounded-xl border border-brand-200 bg-cream-light px-2 py-2 text-center text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
                  min="1"
                  step="1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                />
                <input
                  type="number"
                  value={itemAmount}
                  onChange={(e) => setItemAmount(e.target.value)}
                  placeholder="Unit price"
                  className="flex-1 rounded-xl border border-brand-200 bg-cream-light px-3 py-2 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
                  min="0"
                  step="0.01"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddItem(); }}
                />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!itemName.trim() || !itemAmount}
                className="rounded-xl bg-brand-700 px-4 py-1.5 text-sm font-medium text-cream-light disabled:opacity-40"
              >
                Add Item
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setItemName(""); setItemQty("1"); setItemAmount(""); }}
                className="text-sm text-brand-400 hover:text-brand-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="self-center rounded-full border border-brand-200 px-6 py-2 text-sm font-medium transition-all hover:bg-cream-light active:scale-[0.98]"
          >
            Add Item
          </button>
        )}
      </div>

      {/* Extras toggles */}
      {!isLocked && (
        <div className={`${isMultiSection ? "mt-4 border-t border-brand-100 pt-3" : "mt-6 border-t border-brand-200 pt-4"} space-y-3`}>
          {/* Service Charge */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasServiceCharge}
                onChange={() => onUpdateExtras({
                  serviceChargeRate: hasServiceCharge ? null : (parseFloat(serviceChargePct) || 10) / 100,
                })}
                className="h-4 w-4 rounded border-brand-300 accent-brand-700"
              />
              <span className="text-sm">Service Charge</span>
            </label>
            {hasServiceCharge && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={serviceChargePct}
                  onFocus={() => setScDraft(serviceChargePct)}
                  onChange={(e) => setScDraft(e.target.value)}
                  onBlur={() => { onUpdateExtras({ serviceChargeRate: (parseFloat(serviceChargePct) || 0) / 100 }); setScDraft(null); }}
                  className="w-16 rounded-lg border border-brand-200 bg-cream-light px-2 py-1 text-right text-sm focus:border-brand-400 focus:outline-none"
                  min="0" max="100" step="0.01"
                />
                <span className="text-sm text-brand-400">%</span>
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
                className="h-4 w-4 rounded border-brand-300 accent-brand-700"
              />
              <span className="text-sm">VAT</span>
            </label>
            {hasVat && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={vatPct}
                  onFocus={() => setVatDraft(vatPct)}
                  onChange={(e) => setVatDraft(e.target.value)}
                  onBlur={() => { onUpdateExtras({ vatRate: (parseFloat(vatPct) || 0) / 100 }); setVatDraft(null); }}
                  className="w-16 rounded-lg border border-brand-200 bg-cream-light px-2 py-1 text-right text-sm focus:border-brand-400 focus:outline-none"
                  min="0" max="100" step="0.01"
                />
                <span className="text-sm text-brand-400">%</span>
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
                className="h-4 w-4 rounded border-brand-300 accent-brand-700"
              />
              <span className="text-sm">Discount</span>
            </label>
            {hasDiscount && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => { setDiscountDraft(null); setDiscountMode(discountMode === "flat" ? "pct" : "flat"); }}
                  className="rounded-lg border border-brand-200 px-1.5 py-0.5 text-xs font-medium text-brand-500 hover:bg-cream-light"
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
                  className="w-20 rounded-lg border border-brand-200 bg-cream-light px-2 py-1 text-right text-sm focus:border-brand-400 focus:outline-none"
                  min="0"
                  step={discountMode === "pct" ? "1" : "0.01"}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section subtotal (multi-section only) */}
      {isMultiSection && (
        <div className="mt-3 rounded-xl border border-brand-100 bg-cream px-3 py-2">
          <div className="flex items-center justify-between text-sm text-brand-500">
            <span>Subtotal</span>
            <span>฿{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-success">
              <span>Discount</span>
              <span>-฿{discount.toFixed(2)}</span>
            </div>
          )}
          {hasServiceCharge && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-brand-400">
              <span>SC {serviceChargePct}%</span>
              <span>฿{serviceChargeAmount.toFixed(2)}</span>
            </div>
          )}
          {hasVat && (
            <div className="mt-0.5 flex items-center justify-between text-xs text-brand-400">
              <span>VAT {vatPct}%</span>
              <span>฿{vatAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-brand-200 pt-1">
            <span className="text-sm font-medium">Section Total</span>
            <span className="text-sm font-semibold">฿{sectionTotal.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
