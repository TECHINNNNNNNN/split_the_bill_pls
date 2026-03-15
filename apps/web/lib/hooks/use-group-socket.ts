"use client";

import usePartySocket from "partysocket/react";
import { useQueryClient } from "@tanstack/react-query";

type GroupEvent = {
  type: "member-joined" | "member-left";
  data: Record<string, unknown>;
};

/**
 * Connects to a PartyKit room for group real-time updates.
 * Uses room ID `group-<groupId>` to avoid collisions with
 * quick-split room codes.
 */
export function useGroupSocket(groupId: string) {
  const queryClient = useQueryClient();

  usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
    room: `group-${groupId}`,
    onMessage(event) {
      try {
        const msg: GroupEvent = JSON.parse(event.data);

        if (msg.type === "member-joined" || msg.type === "member-left") {
          queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
        }
      } catch {
        // Ignore malformed messages
      }
    },
  });
}
