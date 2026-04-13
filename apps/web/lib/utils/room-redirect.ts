/**
 * Returns the correct path for a room based on its current status.
 * Used by every Quick Split page to enforce status-based routing —
 * if the user navigates to the wrong page (e.g. back button into /bill
 * when room is in "payment"), the page redirects them here.
 */
export function getCorrectRoomPath(
  code: string,
  status: string,
  isHost: boolean,
): string {
  switch (status) {
    case "waiting":
      return `/quick-split/${code}`;
    case "splitting":
      return `/quick-split/${code}/bill`;
    case "payment":
      return isHost
        ? `/quick-split/${code}/payment`
        : `/quick-split/${code}/tracking`;
    case "settled":
      return `/quick-split/${code}/tracking`;
    default:
      return `/quick-split/${code}`;
  }
}
