"use client";

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
  itemClaimerCounts: Map<string, number>;
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
