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

export interface BillExtras {
  vatRate: number | null;
  serviceChargeRate: number | null;
  discountAmount: number | null;
}

export interface CollabSection {
  id: string;
  name: string;
  items: CollabItem[];
  extras: BillExtras;
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
  const [sections, setSections] = useState<CollabSection[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const queryClient = useQueryClient();

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST!,
    room: roomCode,
    onMessage(event) {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "items:sync":
            if (msg.data.sections) {
              setSections(msg.data.sections as CollabSection[]);
            }
            if (typeof msg.data.locked === "boolean") {
              setIsLocked(msg.data.locked);
            }
            break;

          case "bill-finalized":
            setIsLocked(true);
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

  // ─── Section operations ───

  const addSection = useCallback(
    (name: string) => {
      send({ type: "section:add", data: { name } });
    },
    [send],
  );

  const updateSection = useCallback(
    (sectionId: string, name: string) => {
      send({ type: "section:update", data: { sectionId, name } });
    },
    [send],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      send({ type: "section:delete", data: { sectionId } });
    },
    [send],
  );

  // ─── Item operations (now section-scoped) ───

  const addItem = useCallback(
    (name: string, amount: number, sectionId?: string) => {
      send({
        type: "item:add",
        data: { name, amount, memberId: opts.currentMemberId, sectionId },
      });
    },
    [send, opts.currentMemberId],
  );

  const updateItem = useCallback(
    (itemId: string, sectionId: string, updates: { name?: string; amount?: number }) => {
      send({
        type: "item:update",
        data: { itemId, sectionId, ...updates },
      });
    },
    [send],
  );

  const deleteItem = useCallback(
    (itemId: string, sectionId: string) => {
      send({
        type: "item:delete",
        data: {
          itemId,
          sectionId,
          memberId: opts.currentMemberId,
          isHost: opts.isHost,
        },
      });
    },
    [send, opts.currentMemberId, opts.isHost],
  );

  const toggleMember = useCallback(
    (itemId: string, sectionId: string, memberId: string) => {
      send({
        type: "item:toggle-member",
        data: { itemId, sectionId, targetMemberId: memberId },
      });
    },
    [send],
  );

  const selectAll = useCallback(
    (itemId: string, sectionId: string) => {
      send({
        type: "item:select-all",
        data: {
          itemId,
          sectionId,
          allMemberIds: opts.members.map((m) => m.id),
        },
      });
    },
    [send, opts.members],
  );

  const updateExtras = useCallback(
    (update: Partial<BillExtras>, sectionId?: string) => {
      send({ type: "extras:update", data: { ...update, sectionId } });
    },
    [send],
  );

  return {
    socket,
    sections,
    isLocked,
    addSection,
    updateSection,
    deleteSection,
    addItem,
    updateItem,
    deleteItem,
    toggleMember,
    selectAll,
    updateExtras,
  };
}
