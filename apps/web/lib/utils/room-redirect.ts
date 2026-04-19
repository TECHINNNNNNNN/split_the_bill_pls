/**
 * Returns the set of allowed paths for a room based on its current status.
 * Used by every Quick Split page to enforce status-based routing.
 *
 * Returns a "default" path (where to redirect if on a wrong page)
 * and an "allowed" set (pages that are valid for this status — no redirect needed).
 */
export function getRoomRedirect(
  code: string,
  status: string,
  isHost: boolean,
  currentPath: string,
): string | null {
  const base = `/quick-split/${code}`;
  const waiting = base;
  const bill = `${base}/bill`;
  const payment = `${base}/payment`;
  const tracking = `${base}/tracking`;

  let allowed: string[];
  let fallback: string;

  switch (status) {
    case "waiting":
      allowed = [waiting];
      fallback = waiting;
      break;
    case "splitting":
      allowed = [bill];
      fallback = bill;
      break;
    case "payment":
      // Host can be on payment (setting PromptPay) OR tracking (monitoring payments)
      // Members can be on bill (read-only, while host sets up payment) OR tracking
      allowed = isHost ? [payment, tracking] : [bill, tracking];
      fallback = isHost ? payment : tracking;
      break;
    case "settled":
      allowed = [tracking];
      fallback = tracking;
      break;
    default:
      allowed = [waiting];
      fallback = waiting;
  }

  // If current path is allowed, no redirect needed
  if (allowed.includes(currentPath)) return null;

  // Otherwise redirect to the fallback
  return fallback;
}
