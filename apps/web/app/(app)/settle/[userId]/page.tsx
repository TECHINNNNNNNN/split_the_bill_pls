"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { anyId } from "promptparse/generate";
import toast from "react-hot-toast";
import { settlementQueries } from "@/lib/queries/settlements";
import { useClaimSettlement } from "@/lib/mutations/settlements";
import { useSlipScanner } from "@/lib/hooks/use-slip-scanner";
import type { SlipScanOutput } from "@/lib/hooks/use-slip-scanner";

export default function SettlePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: otherUserId } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: balancesData, isLoading } = useQuery(settlementQueries.balances());
  const claimSettlement = useClaimSettlement();
  const slipScanner = useSlipScanner();

  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<SlipScanOutput | null>(null);
  const [settling, setSettling] = useState(false);

  const balance = balancesData?.balances.find((b) => b.otherUserId === otherUserId);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!balance || balance.netAmount <= 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-gray-500">No outstanding balance with this person.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-400 hover:text-gray-800"
        >
          Go back
        </button>
      </div>
    );
  }

  // Generate PromptPay QR if the other user has a PromptPay ID
  const qrPayload = balance.otherUserPromptpayId
    ? anyId({
        type: balance.otherUserPromptpayType === "national_id" ? "NATID" : "MSISDN",
        target: balance.otherUserPromptpayId,
        amount: balance.netAmount,
      })
    : null;

  const handleSlipUpload = async (file: File) => {
    try {
      // useSlipScanner handles compression internally
      const result = await slipScanner.scanSlip(file);
      if (result) {
        setSlipPreview(result.slipImage);
        setScanResult(result);
      }
    } catch {
      toast.error("Failed to process slip image");
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    try {
      await claimSettlement.mutateAsync({
        otherUserId,
        slipImage: slipPreview ?? undefined,
        transRef: scanResult?.slipData?.transRef ?? undefined,
        sendingBank: scanResult?.slipData?.sendingBank ?? undefined,
      });
      toast.success(`Payment claimed! Waiting for ${balance.otherUserName} to confirm.`);
      router.push("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Settlement failed");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Back
        </button>
        <h1 className="font-heading text-2xl font-bold text-gray-800">Settle Up</h1>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {balance.otherUserImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={balance.otherUserImage}
              alt={balance.otherUserName}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-500">
              {balance.otherUserName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-800">{balance.otherUserName}</p>
            <p className="text-xs text-gray-400">
              Across {balance.roomCount} room{balance.roomCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-4 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm">
          {balance.youOwe > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>You owe them</span>
              <span>฿{balance.youOwe.toFixed(2)}</span>
            </div>
          )}
          {balance.theyOwe > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>They owe you</span>
              <span>-฿{balance.theyOwe.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-800">
            <span>Net amount</span>
            <span>฿{balance.netAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* PromptPay QR */}
      {qrPayload ? (
        <div className="flex flex-col items-center rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-800">
            Scan to pay {balance.otherUserName}
          </p>
          <div className="mt-3 rounded-lg bg-white p-2">
            <QRCodeSVG value={qrPayload} size={200} />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-800">
            ฿{balance.netAmount.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-gray-400">via PromptPay</p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center">
          <p className="text-sm text-gray-500">
            {balance.otherUserName} hasn&apos;t set up PromptPay yet.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Transfer manually and upload your slip below.
          </p>
        </div>
      )}

      {/* Slip upload */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">Upload transfer slip</p>
        <p className="mt-1 text-xs text-gray-400">Optional — helps verify the payment.</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSlipUpload(file);
            e.target.value = "";
          }}
        />

        {slipPreview ? (
          <div className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slipPreview}
              alt="Transfer slip"
              className="max-h-48 w-full rounded-lg object-contain"
            />
            {scanResult?.slipData?.transRef && (
              <p className="mt-2 text-xs text-green-600">
                QR detected — transaction ref: {scanResult.slipData.transRef}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setSlipPreview(null); setScanResult(null); }}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Tap to upload slip
          </button>
        )}
      </div>

      {/* Settle button */}
      <button
        type="button"
        onClick={handleSettle}
        disabled={settling}
        className="rounded-full bg-gray-800 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40"
      >
        {settling
          ? "Claiming..."
          : `I've Paid ฿${balance.netAmount.toFixed(2)}`}
      </button>
    </div>
  );
}
