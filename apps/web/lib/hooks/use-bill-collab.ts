"use client";

import { useState, useCallback } from "react";
import usePartySocket from "partysocket/react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Types (mirrors PartyKit server) ───

export interface CollabItem {
  id: string;
  name: string;
  amount: number;
  memberIds: string[];
  addedBy: string;
}

interface ServerMessage {
  type: string;
  data: Record<string, unknown>;
}

// ─── Hook ───

export function useBillCollab(
  roomCode: string,
  opts: {
    currentMemberId: string;
    isHost: boolean;
    members: { id: string }[];
    onStatusChanged?: (status: string) => void;
  },
) {
  const [items, setItems] = useState<CollabItem[]>([]);
  const queryClient = useQueryClient();

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
    room: roomCode,
    onMessage(event) {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "items:sync":
            setItems((msg.data.items as CollabItem[]) ?? []);
            break;

          // Also handle the standard room events (same as useRoomSocket)
          case "member-joined":
          case "member-removed":
            queryClient.invalidateQueries({ queryKey: ["rooms", "code"] });
            break;

          case "status-changed":
            queryClient.invalidateQueries({ queryKey: ["rooms"] });
            opts.onStatusChanged?.(msg.data.status as string);
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

  const send = useCallback(
    (msg: Record<string, unknown>) => {
      socket.send(JSON.stringify(msg));
    },
    [socket],
  );

  const addItem = useCallback(
    (name: string, amount: number) => {
      send({
        type: "item:add",
        data: { name, amount, memberId: opts.currentMemberId },
      });
    },
    [send, opts.currentMemberId],
  );

  const deleteItem = useCallback(
    (itemId: string) => {
      send({
        type: "item:delete",
        data: {
          itemId,
          memberId: opts.currentMemberId,
          isHost: opts.isHost,
        },
      });
    },
    [send, opts.currentMemberId, opts.isHost],
  );

  const toggleMember = useCallback(
    (itemId: string, memberId: string) => {
      send({
        type: "item:toggle-member",
        data: { itemId, targetMemberId: memberId },
      });
    },
    [send],
  );

  const selectAll = useCallback(
    (itemId: string) => {
      send({
        type: "item:select-all",
        data: {
          itemId,
          allMemberIds: opts.members.map((m) => m.id),
        },
      });
    },
    [send, opts.members],
  );

  return {
    items,
    addItem,
    deleteItem,
    toggleMember,
    selectAll,
  };
}
