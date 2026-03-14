"use client";

import usePartySocket from "partysocket/react";
import { useQueryClient } from "@tanstack/react-query";

type PartyEvent = {
  type:
    | "connected"
    | "member-joined"
    | "member-removed"
    | "status-changed"
    | "payment-toggled";
  data: Record<string, unknown>;
};

/**
 * Connects to a PartyKit room via WebSocket.
 * When events arrive, invalidates the relevant React Query cache
 * so the UI auto-refreshes. Optionally calls onStatusChanged
 * for page redirects.
 */
export function useRoomSocket(
  roomCode: string,
  options?: {
    onStatusChanged?: (status: string) => void;
  },
) {
  const queryClient = useQueryClient();

  usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
    room: roomCode,
    onMessage(event) {
      try {
        const msg: PartyEvent = JSON.parse(event.data);

        switch (msg.type) {
          case "member-joined":
          case "member-removed":
            queryClient.invalidateQueries({ queryKey: ["rooms", "code"] });
            break;

          case "status-changed":
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            options?.onStatusChanged?.(msg.data.status as string);
            break;

          case "payment-toggled":
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    },
  });
}
