/**
 * Warm shimmer skeleton — café aesthetic.
 * Usage: <Skeleton className="h-4 w-32" />
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded-lg ${className}`}
    />
  );
}
