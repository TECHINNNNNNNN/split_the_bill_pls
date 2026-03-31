"use client";

export function ScanProgress({ status }: { status: string }) {
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
              <svg className="h-3.5 w-3.5 animate-spin text-cream-light" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={isDone ? "text-green-300" : isActive ? "text-cream-light" : "text-brand-300"}>
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
