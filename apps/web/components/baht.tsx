"use client";

import NumberFlow from "@number-flow/react";

/**
 * Animated baht amount — digits roll like a mechanical counter.
 * Usage: <Baht value={350.50} />
 */
export function Baht({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <NumberFlow
      value={value}
      format={{
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }}
      className={className}
      transformTiming={{ duration: 500, easing: "ease-out" }}
      spinTiming={{ duration: 500, easing: "ease-out" }}
    />
  );
}
