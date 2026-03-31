"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { settlementQueries } from "@/lib/queries/settlements";
import { useConfirmSettlement, useRejectSettlement } from "@/lib/mutations/settlements";
import { bankNames } from "@/components/tracking/constants";
import { Skeleton } from "@/components/skeleton";

export default function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data, isLoading } = useQuery(settlementQueries.detail(id));
  const confirmSettlement = useConfirmSettlement();
  const rejectSettlement = useRejectSettlement();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data?.settlement) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="font-caveat text-xl text-brand-400">Settlement not found.</p>
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          Go back
        </button>
      </div>
    );
  }

  const { settlement, currentUserId } = data;
  const isCreditor = settlement.payeeUserId === currentUserId;
  const isDebtor = settlement.payerUserId === currentUserId;
  const amount = parseFloat(settlement.netAmount);
  const status = settlement.status;

  const payerName = (settlement as { payer?: { name?: string } }).payer?.name ?? "Unknown";
  const payeeName = (settlement as { payee?: { name?: string } }).payee?.name ?? "Unknown";
  const payerImage = (settlement as { payer?: { image?: string | null } }).payer?.image;
  const payeeImage = (settlement as { payee?: { image?: string | null } }).payee?.image;

  const otherName = isCreditor ? payerName : payeeName;
  const otherImage = isCreditor ? payerImage : payeeImage;

  const bankCode = settlement.slipSendingBank;
  const bankDisplay = bankCode ? (bankNames[bankCode] ?? bankCode) : null;
  const verifiedAmount = settlement.slipVerifiedAmount ? parseFloat(settlement.slipVerifiedAmount) : null;
  const amountMatches = verifiedAmount != null && Math.abs(verifiedAmount - amount) < 0.01;

  const statusConfig = {
    pending: { label: "Pending", classes: "border-brand-200 text-brand-400" },
    claimed: { label: "Claimed", classes: "border-yellow-300 bg-yellow-50 text-yellow-700" },
    confirmed: { label: "Confirmed", classes: "border-green-200 bg-green-50 text-green-700" },
    rejected: { label: "Rejected", classes: "border-red-200 bg-red-50 text-red-600" },
  } as const;

  const statusInfo = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="mt-1 font-caveat text-3xl font-bold">Settlement</h1>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {otherImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={otherImage} alt={otherName} className="h-12 w-12 rounded-full border-2 border-brand-200 object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 font-caveat text-lg font-bold text-brand-600">
                {otherName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-caveat text-lg font-medium">
                {isCreditor ? `${payerName} → You` : `You → ${payeeName}`}
              </p>
              <p className="text-xs text-brand-300">
                {isCreditor ? `${payerName} claims they've paid` : "Waiting for confirmation"}
              </p>
            </div>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.classes}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-center">
          <p className="font-caveat text-4xl font-bold">฿{amount.toFixed(2)}</p>
        </div>
      </div>

      {/* Slip image */}
      {settlement.slipImageData && (
        <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
          <p className="mb-2 font-caveat text-lg font-medium">Transfer Slip</p>
          <div className="mb-3 flex items-center gap-2">
            {bankDisplay && (
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {bankDisplay}
              </span>
            )}
            {verifiedAmount != null && (
              <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${
                amountMatches
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-orange-200 bg-orange-50 text-orange-700"
              }`}>
                {amountMatches ? `Verified ฿${verifiedAmount.toFixed(2)}` : `฿${verifiedAmount.toFixed(2)} (mismatch)`}
              </span>
            )}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={settlement.slipImageData}
            alt="Payment slip"
            className="w-full rounded-xl object-contain"
          />
        </div>
      )}

      {/* Actions */}
      {isCreditor && status === "claimed" && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              confirmSettlement.mutate(id, {
                onSuccess: () => {
                  toast.success(`Settlement confirmed! All payments resolved.`);
                  router.push("/home");
                },
                onError: () => toast.error("Couldn't confirm — try again"),
              });
            }}
            disabled={confirmSettlement.isPending}
            className="flex-1 rounded-xl bg-green-100 px-4 py-3 text-sm font-medium text-green-800 transition-all hover:bg-green-200 active:scale-[0.97] disabled:opacity-40"
          >
            {confirmSettlement.isPending ? "Confirming..." : "Confirm"}
          </button>
          <button
            type="button"
            onClick={() => {
              rejectSettlement.mutate(id, {
                onSuccess: () => {
                  toast("Settlement rejected", { icon: "🚫" });
                  router.push("/home");
                },
                onError: () => toast.error("Couldn't reject — try again"),
              });
            }}
            disabled={rejectSettlement.isPending}
            className="flex-1 rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700 transition-all hover:bg-red-200 active:scale-[0.97] disabled:opacity-40"
          >
            {rejectSettlement.isPending ? "..." : "Reject"}
          </button>
        </div>
      )}

      {/* Status messages */}
      {isDebtor && status === "claimed" && (
        <p className="text-center font-caveat text-base text-brand-400">
          Waiting for {payeeName} to confirm your payment...
        </p>
      )}
      {status === "confirmed" && (
        <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 text-center shadow-sm">
          <p className="font-caveat text-lg font-medium text-success">Settlement confirmed!</p>
          <p className="mt-1 font-serif text-xs italic text-brand-300">All underlying room payments have been resolved.</p>
        </div>
      )}
      {status === "rejected" && isDebtor && (
        <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 text-center shadow-sm">
          <p className="font-caveat text-lg font-medium text-error">Settlement rejected</p>
          <p className="mt-1 font-serif text-xs italic text-brand-300">You can try again with a new slip.</p>
          <button
            type="button"
            onClick={() => router.push(`/settle/${settlement.payeeUserId}`)}
            className="mt-3 rounded-full bg-brand-700 px-6 py-2 text-xs font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
