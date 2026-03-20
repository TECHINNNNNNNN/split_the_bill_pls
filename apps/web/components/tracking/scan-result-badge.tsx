"use client";

export function ScanResultBadge({ status, bankName }: { status: string; bankName?: string }) {
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
