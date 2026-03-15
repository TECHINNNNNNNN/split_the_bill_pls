"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { anyId } from "promptparse/generate";
import toast from "react-hot-toast";
import { roomQueries } from "@/lib/queries/rooms";
import { useClaimPayment, useConfirmPayment, useRejectPayment } from "@/lib/mutations/rooms";
import { useRoomSocket } from "@/lib/hooks/use-room-socket";
import { useSlipScanner } from "@/lib/hooks/use-slip-scanner";
import type { SlipScanOutput } from "@/lib/hooks/use-slip-scanner";

type PaymentStatus = "unpaid" | "claimed" | "confirmed" | "rejected";

// Status badge colors and labels
const statusConfig: Record<PaymentStatus, { label: string; classes: string }> = {
  unpaid: { label: "Unpaid", classes: "border-gray-300 text-gray-500" },
  claimed: { label: "Claimed", classes: "border-yellow-300 bg-yellow-50 text-yellow-700" },
  confirmed: { label: "Confirmed", classes: "border-green-200 bg-green-50 text-green-700" },
  rejected: { label: "Rejected", classes: "border-red-200 bg-red-50 text-red-600" },
};

// Thai bank codes → display names
const bankNames: Record<string, string> = {
  "002": "BBL",
  "004": "KBANK",
  "006": "KTB",
  "011": "TMBThanachart",
  "014": "SCB",
  "025": "KKP",
  "030": "GSB",
  "069": "KMA",
  "022": "CIMBT",
  "024": "UOB",
  "034": "BAAC",
  "066": "ISBT",
  "065": "TISCO",
  "073": "LH Bank",
};

// ─── Scan progress steps ───

function ScanProgress({ status }: { status: string }) {
  const steps = [
    { key: "compressing", label: "Compressing image" },
    { key: "scanning-qr", label: "Scanning QR code" },
  ];

  const currentIdx = steps.findIndex((s) => s.key === status);
  if (currentIdx === -1) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {steps.map((step, i) => {
        const isDone = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center gap-2 text-xs">
            {isDone && (
              <svg className="h-3.5 w-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isActive && (
              <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={isDone ? "text-green-300" : isActive ? "text-white" : "text-gray-500"}>
              {step.label}
              {isDone && " — done"}
              {isActive && "..."}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Scan result badge ───

function ScanResultBadge({ status, bankName }: { status: string; bankName?: string }) {
  if (status === "success") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-green-900/40 px-2.5 py-1.5 text-xs text-green-300">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        QR detected{bankName ? ` — ${bankName}` : ""} — will be verified by host
      </div>
    );
  }
  if (status === "no-qr") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-yellow-900/30 px-2.5 py-1.5 text-xs text-yellow-200">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        No QR found — slip image will still be sent to host
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-red-900/30 px-2.5 py-1.5 text-xs text-red-300">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Scan failed — try a clearer photo
      </div>
    );
  }
  return null;
}

// ─── Slip detail modal for host ───

function SlipModal({
  image,
  memberName,
  amount,
  bankCode,
  verifiedAmount,
  onClose,
}: {
  image: string;
  memberName: string;
  amount: number;
  bankCode: string | null;
  verifiedAmount: number | null;
  onClose: () => void;
}) {
  const amountMatches = verifiedAmount != null && Math.abs(verifiedAmount - amount) < 0.01;
  const bankDisplay = bankCode ? (bankNames[bankCode] ?? bankCode) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">{memberName}&apos;s slip</p>
            <p className="text-xs text-gray-500">Owes ฿{amount.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Bank badge */}
            {bankDisplay && (
              <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {bankDisplay}
              </span>
            )}
            {/* Verification badge */}
            {verifiedAmount != null && (
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                amountMatches
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-orange-200 bg-orange-50 text-orange-700"
              }`}>
                {amountMatches ? `Verified ฿${verifiedAmount.toFixed(2)}` : `฿${verifiedAmount.toFixed(2)} (mismatch)`}
              </span>
            )}
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Slip image */}
        <div className="flex-1 overflow-auto bg-gray-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Payment slip"
            className="w-full rounded-lg object-contain"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───

export default function PaymentTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [slipModal, setSlipModal] = useState<{
    image: string;
    memberName: string;
    amount: number;
    bankCode: string | null;
    verifiedAmount: number | null;
  } | null>(null);

  // Member slip flow state — gates the entire action area to prevent stale UI flashes
  type SlipFlowState =
    | { step: "idle" }
    | { step: "scanning"; paymentId: string }
    | { step: "preview"; paymentId: string; output: SlipScanOutput }
    | { step: "submitting"; paymentId: string; output: SlipScanOutput }
    | { step: "done" }; // claimed successfully — hold until server status catches up

  const [slipFlow, setSlipFlow] = useState<SlipFlowState>({ step: "idle" });

  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";
  const currentMemberId = codeData?.currentMemberId;

  const { data: detailData } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
  });

  const room = detailData?.room;
  const members = room?.members ?? [];
  const payments = room?.payments ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;
  const hostMember = members.find((m) => m.isHost);

  const claimPayment = useClaimPayment(roomId);
  const confirmPayment = useConfirmPayment(roomId);
  const rejectPayment = useRejectPayment(roomId);
  const { result: slipResult, previewUrl, scanSlip, reset: resetSlip } = useSlipScanner();

  // WebSocket: instant updates when payment statuses change
  useRoomSocket(code);

  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const confirmedPayments = payments.filter((p) => p.status === "confirmed");
  const confirmedTotal = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const confirmedCount = confirmedPayments.length;

  // Handle slip file selection — set scanning state SYNCHRONOUSLY before async work
  const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>, paymentId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediately gate UI to "scanning" — prevents stale state flash
    setSlipFlow({ step: "scanning", paymentId });

    const output = await scanSlip(file);
    if (output) {
      setSlipFlow({ step: "preview", paymentId, output });
    } else {
      // Scan failed entirely — go back to idle so user can retry
      setSlipFlow({ step: "idle" });
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit the scanned slip
  const handleConfirmClaim = () => {
    if (slipFlow.step !== "preview") return;
    const { paymentId, output } = slipFlow;
    setSlipFlow({ step: "submitting", paymentId, output });

    claimPayment.mutate(
      {
        paymentId,
        slipData: output.slipData ?? undefined,
        slipImage: output.slipImage,
      },
      {
        onSuccess: () => {
          setSlipFlow({ step: "done" });
          resetSlip();
        },
        onError: () => {
          // Go back to preview so they can retry
          setSlipFlow({ step: "preview", paymentId, output });
          toast.error("Couldn't submit — try again 😅");
        },
      }
    );
  };

  // Cancel the pending scan
  const handleCancelScan = () => {
    setSlipFlow({ step: "idle" });
    resetSlip();
  };

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Header */}
      <button
        type="button"
        onClick={() => router.back()}
        className="self-start text-sm text-gray-500 hover:text-gray-800"
      >
        Back
      </button>
      <h1 className="mt-2 font-heading text-2xl font-bold text-gray-800 md:text-3xl">
        Payment Tracking
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isHost ? "Track who has paid." : "See how much you owe."}
      </p>

      {/* PromptPay QR + amount + claim button — shown to non-host members */}
      {!isHost && currentMemberId && (() => {
        const myPayment = payments.find((p) => p.memberId === currentMemberId);
        if (!myPayment) return null;
        const myAmount = parseFloat(myPayment.amount);
        const status = myPayment.status as PaymentStatus;

        // Generate PromptPay QR payload if the host set up PromptPay
        const qrPayload = room.promptpayId && status !== "confirmed"
          ? anyId({
              type: room.promptpayType === "national_id" ? "NATID" : "MSISDN",
              target: room.promptpayId,
              amount: myAmount,
            })
          : null;

        const canClaim = status === "unpaid" || status === "rejected";
        // Once server catches up to "claimed", we can clear the "done" hold
        if (slipFlow.step === "done" && status === "claimed") {
          // Schedule reset to avoid setState during render
          queueMicrotask(() => setSlipFlow({ step: "idle" }));
        }
        // slipFlow gates the entire action area — prevents stale state flashes
        const isInSlipFlow = slipFlow.step !== "idle";

        return (
          <>
            {/* QR code — hide once confirmed */}
            {qrPayload && (
              <div className="mt-4 flex flex-col items-center rounded-lg border border-gray-200 bg-white p-5">
                <p className="text-sm font-medium text-gray-800">
                  Scan to pay {hostMember?.displayName}
                </p>
                <div className="mt-3 rounded-lg bg-white p-2">
                  <QRCodeSVG value={qrPayload} size={200} />
                </div>
                <p className="mt-3 text-2xl font-bold text-gray-800">
                  ฿{myAmount.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  PromptPay: {room.promptpayId}
                </p>
              </div>
            )}

            {/* Status card for the member */}
            <div className={`mt-4 rounded-lg border p-4 ${
              status === "confirmed"
                ? "border-green-300 bg-green-50"
                : "border-gray-800 bg-gray-800"
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-medium ${
                  status === "confirmed" ? "text-green-800" : "text-white"
                }`}>
                  {status === "confirmed" ? "Payment confirmed" : "You owe"}
                </span>
                <span className={`text-xl font-bold ${
                  status === "confirmed" ? "text-green-800" : "text-white"
                }`}>
                  ฿{myAmount.toFixed(2)}
                </span>
              </div>

              {/* Hidden file input — always rendered so ref works */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleSlipUpload(e, myPayment.id)}
              />

              {/* ── Slip flow: scanning ── */}
              {isInSlipFlow && slipFlow.step === "scanning" && (
                <ScanProgress status={slipResult.status} />
              )}

              {/* ── Slip flow: preview (scan done, awaiting user confirm) ── */}
              {isInSlipFlow && (slipFlow.step === "preview" || slipFlow.step === "submitting") && (
                <div className="mt-3 space-y-2">
                  {/* Thumbnail preview */}
                  {previewUrl && (
                    <div className="flex items-start gap-3 rounded-md bg-white/10 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Slip preview"
                        className="h-16 w-12 rounded border border-white/20 object-cover"
                      />
                      <div className="flex-1">
                        <ScanResultBadge
                          status={slipResult.status}
                          bankName={slipResult.status === "success" && slipResult.data.sendingBank
                            ? (bankNames[slipResult.data.sendingBank] ?? slipResult.data.sendingBank)
                            : undefined}
                        />
                      </div>
                    </div>
                  )}

                  {/* Confirm / cancel buttons */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmClaim}
                      disabled={slipFlow.step === "submitting"}
                      className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-40"
                    >
                      {slipFlow.step === "submitting" ? "Sending..." : "Send to Host"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelScan}
                      disabled={slipFlow.step === "submitting"}
                      className="rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Default state: upload / claim buttons (only when NOT in slip flow) ── */}
              {canClaim && !isInSlipFlow && (
                <>
                  {/* Rejected hint */}
                  {status === "rejected" && (
                    <p className="mt-2 text-sm text-red-300">
                      Host rejected your claim. Upload a new slip or try again.
                    </p>
                  )}

                  {/* Primary: Upload Slip */}
                  <button
                    type="button"
                    onClick={() => {
                      resetSlip();
                      fileInputRef.current?.click();
                    }}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {status === "rejected" ? "Upload New Slip" : "Upload Slip & Claim"}
                  </button>

                  {/* Secondary: Claim without slip */}
                  <button
                    type="button"
                    onClick={() => claimPayment.mutate(
                      { paymentId: myPayment.id },
                      {
                        onError: () => toast.error("Couldn't submit — try again 😅"),
                      }
                    )}
                    disabled={claimPayment.isPending}
                    className="mt-2 w-full text-center text-xs text-gray-400 underline transition-colors hover:text-gray-200 disabled:opacity-40"
                  >
                    I&apos;ve paid (no slip)
                  </button>
                </>
              )}

              {/* ── Claimed / just submitted: waiting for host ── */}
              {(status === "claimed" || slipFlow.step === "done") && slipFlow.step !== "scanning" && slipFlow.step !== "preview" && slipFlow.step !== "submitting" && (
                <p className="mt-2 text-sm text-yellow-200">
                  Waiting for host to confirm...
                </p>
              )}
              {status === "confirmed" && (
                <p className="mt-1 text-sm text-green-600">
                  Thank you!
                </p>
              )}
            </div>
          </>
        );
      })()}

      {/* Progress bar */}
      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {confirmedCount}/{payments.length} confirmed
          </span>
          <span className="text-gray-800">
            ฿{confirmedTotal.toFixed(2)}/฿{total.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-800 transition-all duration-300"
            style={{
              width: `${payments.length > 0 ? (confirmedCount / payments.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Host card */}
      {hostMember && (
        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-800">
              {hostMember.displayName}
              {isHost && <span className="text-gray-400"> (you)</span>}
            </span>
            <span className="text-gray-800">
              ฿{(() => {
                const hostPayment = payments.find(
                  (p) => p.memberId === hostMember.id
                );
                return hostPayment
                  ? parseFloat(hostPayment.amount).toFixed(2)
                  : "0.00";
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Member payment cards */}
      <div className="mt-2 space-y-2">
        {payments
          .filter((p) => p.memberId !== hostMember?.id)
          .map((payment) => {
            const status = payment.status as PaymentStatus;
            const config = statusConfig[status];
            const hasSlip = !!payment.slipTransRef || !!payment.slipImageData;
            const hasVerification = !!payment.slipVerifiedAmount;
            const verifiedAmount = hasVerification ? parseFloat(payment.slipVerifiedAmount!) : null;
            const owedAmount = parseFloat(payment.amount);
            const amountMatches = verifiedAmount != null && Math.abs(verifiedAmount - owedAmount) < 0.01;

            return (
              <div
                key={payment.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Status icon */}
                    {status === "confirmed" && (
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {status === "claimed" && (
                      <svg className="h-4 w-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {status === "unpaid" && (
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {status === "rejected" && (
                      <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="font-medium text-gray-800">
                      {payment.member?.displayName}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-gray-800">
                      ฿{parseFloat(payment.amount).toFixed(2)}
                    </span>

                    {/* Status badge (always visible) */}
                    <span className={`rounded-lg border px-2.5 py-0.5 text-xs font-medium ${config.classes}`}>
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* Slip verification info — visible to host */}
                {isHost && hasSlip && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {/* Slip badge — clickable to view slip image */}
                    <button
                      type="button"
                      onClick={() => {
                        if (payment.slipImageData) {
                          setSlipModal({
                            image: payment.slipImageData,
                            memberName: payment.member?.displayName ?? "Member",
                            amount: owedAmount,
                            bankCode: payment.slipSendingBank ?? null,
                            verifiedAmount,
                          });
                        }
                      }}
                      className={`inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700 ${
                        payment.slipImageData ? "cursor-pointer hover:bg-blue-100" : "cursor-default"
                      }`}
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {payment.slipSendingBank
                        ? `Slip: ${bankNames[payment.slipSendingBank] ?? payment.slipSendingBank}`
                        : "Slip attached"}
                      {payment.slipImageData && (
                        <svg className="ml-0.5 h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Verified amount badge */}
                    {hasVerification && (
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${
                        amountMatches
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-orange-200 bg-orange-50 text-orange-700"
                      }`}>
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {amountMatches ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          )}
                        </svg>
                        Verified: ฿{verifiedAmount!.toFixed(2)}
                        {amountMatches ? " (match)" : " (mismatch!)"}
                      </span>
                    )}
                  </div>
                )}

                {/* Host actions — confirm from unpaid or claimed, reject only claimed */}
                {isHost && (status === "claimed" || status === "unpaid") && (
                  <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                    <button
                      type="button"
                      onClick={() => confirmPayment.mutate(payment.id, {
                        onSuccess: () => toast.success(`${payment.member?.displayName} confirmed! 🎉`),
                        onError: () => toast.error("Couldn't confirm — try again"),
                      })}
                      disabled={confirmPayment.isPending && confirmPayment.variables === payment.id}
                      className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-40"
                    >
                      {confirmPayment.isPending && confirmPayment.variables === payment.id ? "..." : "Confirm"}
                    </button>
                    {status === "claimed" && (
                      <button
                        type="button"
                        onClick={() => rejectPayment.mutate(payment.id, {
                          onSuccess: () => toast(`${payment.member?.displayName}'s claim rejected`, { icon: "🚫" }),
                          onError: () => toast.error("Couldn't reject — try again"),
                        })}
                        disabled={rejectPayment.isPending && rejectPayment.variables === payment.id}
                        className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                      >
                        {rejectPayment.isPending && rejectPayment.variables === payment.id ? "..." : "Reject"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Back to Home */}
      <div className="mt-auto flex justify-center pt-8">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 md:px-10 md:py-3 md:text-base"
        >
          Back to Home
        </button>
      </div>

      {/* Slip detail modal — shown when host taps a slip badge */}
      {slipModal && (
        <SlipModal
          image={slipModal.image}
          memberName={slipModal.memberName}
          amount={slipModal.amount}
          bankCode={slipModal.bankCode}
          verifiedAmount={slipModal.verifiedAmount}
          onClose={() => setSlipModal(null)}
        />
      )}
    </div>
  );
}
