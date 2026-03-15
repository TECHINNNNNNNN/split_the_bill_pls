"use client";

import usePartySocket from "partysocket/react";
import { useQueryClient } from "@tanstack/react-query";

type UserEvent = {
  type: "invite-received";
  data: Record<string, unknown>;
};

/**
 * Connects to a per-user PartyKit room (`user-<userId>`).
 * Used on /home to receive real-time notifications like
 * new room invites without needing a page refresh.
 */
export function useUserSocket(userId: string | undefined) {
  const queryClient = useQueryClient();

  usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
    room: `user-${userId}`,
    enabled: !!userId,
    onMessage(event) {
      try {
        const msg: UserEvent = JSON.parse(event.data);

        if (msg.type === "invite-received") {
          queryClient.invalidateQueries({ queryKey: ["rooms", "invites"] });
        }
      } catch {
        // Ignore malformed messages
      }
    },
  });
}
