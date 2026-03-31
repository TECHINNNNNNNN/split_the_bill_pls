"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { settlementQueries } from "@/lib/queries/settlements";
import { useConfirmSettlement, useRejectSettlement } from "@/lib/mutations/settlements";
import { bankNames } from "@/components/tracking/constants";

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
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!data?.settlement) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-gray-500">Settlement not found.</p>
        <button type="button" onClick={() => router.push("/home")} className="text-sm text-gray-400 hover:text-gray-800">
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
    pending: { label: "Pending", classes: "border-gray-300 text-gray-500" },
    claimed: { label: "Claimed", classes: "border-yellow-300 bg-yellow-50 text-yellow-700" },
    confirmed: { label: "Confirmed", classes: "border-green-200 bg-green-50 text-green-700" },
    rejected: { label: "Rejected", classes: "border-red-200 bg-red-50 text-red-600" },
  } as const;

  const statusInfo = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <button type="button" onClick={() => router.push("/home")} className="text-sm text-gray-500 hover:text-gray-800">
          Back
        </button>
        <h1 className="font-heading text-2xl font-bold text-gray-800">Settlement</h1>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {otherImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={otherImage} alt={otherName} className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-500">
                {otherName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium text-gray-800">
                {isCreditor ? `${payerName} → You` : `You → ${payeeName}`}
              </p>
              <p className="text-xs text-gray-400">
                {isCreditor ? `${payerName} claims they've paid` : "Waiting for confirmation"}
              </p>
            </div>
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.classes}`}>
            {statusInfo.label}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-center">
          <p className="text-3xl font-bold text-gray-800">฿{amount.toFixed(2)}</p>
        </div>
      </div>

      {/* Slip image */}
      {settlement.slipImageData && (
        <div className="rounded-xl border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium text-gray-800">Transfer Slip</p>
          <div className="flex items-center gap-2 mb-3">
            {bankDisplay && (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {bankDisplay}
              </span>
            )}
            {verifiedAmount != null && (
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
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
            className="w-full rounded-lg object-contain"
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
            className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-40"
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
            className="flex-1 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
          >
            {rejectSettlement.isPending ? "..." : "Reject"}
          </button>
        </div>
      )}

      {/* Status messages */}
      {isDebtor && status === "claimed" && (
        <p className="text-center text-sm text-gray-400">
          Waiting for {payeeName} to confirm your payment...
        </p>
      )}
      {status === "confirmed" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="font-medium text-green-700">Settlement confirmed!</p>
          <p className="mt-1 text-xs text-green-600">All underlying room payments have been resolved.</p>
        </div>
      )}
      {status === "rejected" && isDebtor && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="font-medium text-red-600">Settlement rejected</p>
          <p className="mt-1 text-xs text-red-500">You can try again with a new slip.</p>
          <button
            type="button"
            onClick={() => router.push(`/settle/${settlement.payeeUserId}`)}
            className="mt-3 rounded-full bg-gray-800 px-6 py-2 text-xs font-medium text-white"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
