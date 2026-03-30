/**
 * Warm pulsing skeleton — matches the café aesthetic.
 * Usage: <Skeleton className="h-4 w-32" />
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-brand-100 ${className}`}
    />
  );
}
