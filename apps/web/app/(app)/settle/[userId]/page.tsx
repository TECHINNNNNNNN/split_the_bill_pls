"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { anyId } from "promptparse/generate";
import { toast } from "sonner";
import { settlementQueries } from "@/lib/queries/settlements";
import { useClaimSettlement } from "@/lib/mutations/settlements";
import { useSlipScanner } from "@/lib/hooks/use-slip-scanner";
import type { SlipScanOutput } from "@/lib/hooks/use-slip-scanner";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { Skeleton } from "@/components/skeleton";

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

  useWakeLock(!!balance && balance.netAmount > 0 && !!balance.otherUserPromptpayId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-12 rounded-full" />
      </div>
    );
  }

  if (!balance || balance.netAmount <= 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="font-caveat text-xl text-brand-400">No outstanding balance with this person.</p>
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

  const qrPayload = balance.otherUserPromptpayId
    ? anyId({
        type: balance.otherUserPromptpayType === "national_id" ? "NATID" : "MSISDN",
        target: balance.otherUserPromptpayId,
        amount: balance.netAmount,
      })
    : null;

  const handleSlipUpload = async (file: File) => {
    try {
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
          onClick={() => router.push("/home")}
          className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="mt-1 font-caveat text-3xl font-bold">Settle Up</h1>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {balance.otherUserImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={balance.otherUserImage}
              alt={balance.otherUserName}
              className="h-12 w-12 rounded-full border-2 border-brand-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 font-caveat text-lg font-bold text-brand-600">
              {balance.otherUserName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-caveat text-lg font-medium">{balance.otherUserName}</p>
            <p className="text-xs text-brand-300">
              Across {balance.roomCount} room{balance.roomCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="mt-4 space-y-1 rounded-xl bg-cream px-3 py-2 text-sm">
          {balance.youOwe > 0 && (
            <div className="flex justify-between text-brand-500">
              <span>You owe them</span>
              <span className="tabular-nums">฿{balance.youOwe.toFixed(2)}</span>
            </div>
          )}
          {balance.theyOwe > 0 && (
            <div className="flex justify-between text-brand-500">
              <span>They owe you</span>
              <span className="tabular-nums">-฿{balance.theyOwe.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-brand-200 pt-1 font-semibold">
            <span>Net amount</span>
            <span className="tabular-nums">฿{balance.netAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* PromptPay QR */}
      {qrPayload ? (
        <div className="flex flex-col items-center rounded-2xl border border-brand-200 bg-cream-light p-5 shadow-sm">
          <p className="font-serif text-sm italic text-brand-400">
            Scan to pay {balance.otherUserName}
          </p>
          <div className="mt-3 rounded-xl border border-brand-100 bg-cream-light p-3">
            <QRCodeSVG value={qrPayload} size={200} fgColor="#3d2810" bgColor="transparent" />
          </div>
          <p className="mt-3 font-caveat text-3xl font-bold">
            ฿{balance.netAmount.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-brand-300">via PromptPay</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-brand-300 bg-cream-light p-5 text-center shadow-sm">
          <p className="text-sm text-brand-500">
            {balance.otherUserName} hasn&apos;t set up PromptPay yet.
          </p>
          <p className="mt-1 font-serif text-xs italic text-brand-300">
            Transfer manually and upload your slip below.
          </p>
        </div>
      )}

      {/* Slip upload */}
      <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
        <p className="font-caveat text-lg font-medium">Upload transfer slip</p>
        <p className="mt-1 font-serif text-xs italic text-brand-300">Optional — helps verify the payment.</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
              className="max-h-48 w-full rounded-xl object-contain"
            />
            {scanResult?.slipData?.transRef && (
              <p className="mt-2 text-xs text-success">
                QR detected — transaction ref: {scanResult.slipData.transRef}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setSlipPreview(null); setScanResult(null); }}
              className="mt-2 text-xs text-brand-300 hover:text-brand-500"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 w-full rounded-xl border border-dashed border-brand-300 bg-cream px-4 py-3 text-sm text-brand-400 transition-all hover:border-brand-400 hover:bg-cream-light active:scale-[0.99]"
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
        className="rounded-full bg-brand-700 px-8 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40"
      >
        {settling
          ? "Claiming..."
          : `I've Paid ฿${balance.netAmount.toFixed(2)}`}
      </button>
    </div>
  );
}
