"use client";

import { useEffect, useState } from "react";
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
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const amountMatches = verifiedAmount != null && Math.abs(verifiedAmount - amount) < 0.01;
  const bankDisplay = bankCode ? (bankNames[bankCode] ?? bankCode) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      style={{
        backgroundColor: "rgba(61, 40, 16, 0.5)",
        opacity: visible ? 1 : 0,
      }}
      onClick={handleClose}
    >
      <div
        className="scrollbar-hidden relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-brand-200 bg-cream shadow-2xl transition-all duration-300 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <div>
            <p className="font-caveat text-lg font-semibold">{memberName}&apos;s slip</p>
            <p className="text-xs text-brand-400">Owes ฿{amount.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
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
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-1.5 text-brand-300 transition-colors hover:bg-brand-50 hover:text-brand-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Slip image */}
        <div className="flex-1 overflow-auto bg-cream-light p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt="Payment slip"
            className="w-full rounded-xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}
