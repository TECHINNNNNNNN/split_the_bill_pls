"use client";

import { bankNames } from "./constants";

export function SlipModal({
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
