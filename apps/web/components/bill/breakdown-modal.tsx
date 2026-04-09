"use client";

import { useEffect, useState } from "react";
import type { MemberSplit } from "@pladuk/shared/utils";

export interface SectionBreakdown {
  sectionName: string;
  subtotal: number;
  discountAmount: number;
  serviceChargeAmount: number;
  vatAmount: number;
  sectionTotal: number;
  splits: MemberSplit[];
  roundingDifference: number;
  itemShareInfo: Map<string, { totalShares: number; memberShares: Record<string, number> }>;
}

export function BreakdownModal({
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
  // Animate in on mount
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const sortedMembers = [...members].sort((a, b) => {
    if (a.id === currentMemberId) return -1;
    if (b.id === currentMemberId) return 1;
    return 0;
  });

  const fmt = (n: number) => `฿${n.toFixed(2)}`;
  const pct = (n: number) => `${parseFloat((n * 100).toFixed(2))}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop — fade in */}
      <div
        className="fixed inset-0 transition-opacity duration-300"
        style={{
          backgroundColor: "rgba(61, 40, 16, 0.35)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Panel — slide up + fade in with gentle spring feel */}
      <div
        className="scrollbar-hidden relative max-h-[85svh] w-full max-w-md overflow-y-auto rounded-t-2xl border-t border-brand-200 bg-cream px-5 pb-8 pt-5 shadow-lg transition-all duration-300 ease-out sm:rounded-2xl sm:border"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
        }}
      >
        {/* Drag indicator — mobile sheet feel */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-brand-200 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-caveat text-2xl font-semibold">
            Calculation Breakdown
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1.5 text-brand-300 transition-colors hover:bg-brand-50 hover:text-brand-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 font-serif text-xs italic text-brand-300">
          Updates live as the bill changes
        </p>

        {/* Member breakdowns */}
        <div className="mt-4 flex flex-col gap-4">
          {sortedMembers.map((member, memberIndex) => {
            const isCurrentUser = member.id === currentMemberId;

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
                className={`rounded-2xl border p-4 transition-all duration-300 ease-out ${
                  isCurrentUser
                    ? "border-brand-700 bg-cream-light shadow-sm"
                    : "border-brand-200 bg-cream-light"
                }`}
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(12px)",
                  transitionDelay: `${150 + memberIndex * 60}ms`,
                }}
              >
                {/* Member name header */}
                <div className="flex items-center gap-2">
                  <h3 className="font-caveat text-lg font-semibold">
                    {member.displayName}
                  </h3>
                  {member.isHost && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-500">host</span>
                  )}
                  {isCurrentUser && (
                    <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-medium text-cream-light">you</span>
                  )}
                </div>

                {memberSections.length === 0 ? (
                  <p className="mt-2 font-caveat text-sm text-brand-300">No items assigned</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-3">
                    {memberSections.map(({ breakdown: bd, split }, si) => (
                      <div key={si}>
                        {/* Section name (multi-section only) */}
                        {isMultiSection && (
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brand-300">
                            {bd.sectionName}
                          </p>
                        )}

                        {/* Items */}
                        <div className="space-y-1">
                          {split.items.map((item) => {
                            const info = bd.itemShareInfo.get(item.itemId);
                            const totalShares = info?.totalShares ?? 1;
                            const myShare = info?.memberShares[memberId] ?? 1;
                            const itemTotal = totalShares > 0 ? item.shareAmount * (totalShares / myShare) : item.shareAmount;
                            const isOnlyMe = totalShares === myShare && Object.keys(info?.memberShares ?? {}).length === 1;
                            const isEqual = totalShares > myShare && myShare === 1 && Object.values(info?.memberShares ?? {}).every((s) => s === 1);
                            return (
                              <div key={item.itemId} className="flex items-baseline justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs">{item.name}</span>
                                  <span className="ml-1 text-[10px] text-brand-300">
                                    {isOnlyMe
                                      ? "(only you)"
                                      : isEqual
                                        ? `(÷${Object.keys(info?.memberShares ?? {}).length})`
                                        : `(×${myShare} of ${totalShares})`}
                                  </span>
                                </div>
                                <div className="shrink-0 text-right">
                                  {!isOnlyMe && (
                                    <span className="text-[10px] tabular-nums text-brand-300">
                                      {isEqual
                                        ? `${fmt(itemTotal)} ÷ ${Object.keys(info?.memberShares ?? {}).length} = `
                                        : `${fmt(itemTotal)} × ${myShare}/${totalShares} = `}
                                    </span>
                                  )}
                                  <span className="text-xs tabular-nums font-medium">
                                    {fmt(item.shareAmount)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Items subtotal */}
                        <div className="mt-1.5 flex items-center justify-between border-t border-dashed border-brand-200 pt-1.5">
                          <span className="text-[10px] text-brand-400">Items subtotal</span>
                          <span className="text-xs tabular-nums font-medium">{fmt(split.itemsSubtotal)}</span>
                        </div>

                        {/* Proportion */}
                        {bd.subtotal > 0 && (
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[10px] text-brand-300">Your proportion</span>
                            <span className="text-[10px] tabular-nums text-brand-300">
                              {fmt(split.itemsSubtotal)} / {fmt(bd.subtotal)} = {pct(split.proportion)}
                            </span>
                          </div>
                        )}

                        {/* Extras */}
                        {(split.discountShare > 0 || split.serviceChargeShare > 0 || split.vatShare > 0) && (
                          <div className="mt-2 space-y-0.5">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-brand-300">Extras</p>
                            {split.discountShare > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-brand-300">
                                  Discount: {fmt(bd.discountAmount)} × {pct(split.proportion)}
                                </span>
                                <span className="text-xs tabular-nums font-medium text-success">
                                  -{fmt(split.discountShare)}
                                </span>
                              </div>
                            )}
                            {split.serviceChargeShare > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-brand-300">
                                  SC: {fmt(bd.serviceChargeAmount)} × {pct(split.proportion)}
                                </span>
                                <span className="text-xs tabular-nums font-medium text-brand-400">
                                  +{fmt(split.serviceChargeShare)}
                                </span>
                              </div>
                            )}
                            {split.vatShare > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-brand-300">
                                  VAT: {fmt(bd.vatAmount)} × {pct(split.proportion)}
                                </span>
                                <span className="text-xs tabular-nums font-medium text-brand-400">
                                  +{fmt(split.vatShare)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section total (multi-section) */}
                        {isMultiSection && (
                          <div className="mt-1.5 flex items-center justify-between border-t border-brand-200 pt-1.5">
                            <span className="text-xs text-brand-500">Section total</span>
                            <span className="text-xs tabular-nums font-semibold">{fmt(split.totalAmount)}</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Grand total */}
                    <div className={`flex items-center justify-between ${isMultiSection ? "border-t-2 border-brand-700 pt-2" : "border-t border-brand-200 pt-1.5"}`}>
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-sm tabular-nums font-bold">{fmt(grandTotal)}</span>
                    </div>

                    {/* Rounding note */}
                    {memberSections.some(({ breakdown: bd }) => {
                      const lastSplit = bd.splits[bd.splits.length - 1];
                      return lastSplit?.memberId === member.id && Math.abs(bd.roundingDifference) >= 0.005;
                    }) && (
                      <p className="font-caveat text-xs text-brand-300">
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
