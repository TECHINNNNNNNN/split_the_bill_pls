"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { roomQueries } from "@/lib/queries/rooms";
import { useAdvanceRoomStatus, useAddPlaceholderMember, useRemoveMember } from "@/lib/mutations/rooms";
import { useRoomSocket } from "@/lib/hooks/use-room-socket";

// ─── Main component ───

export default function RoomLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  // Fetch room data
  const { data } = useQuery(roomQueries.byCode(code));

  // WebSocket: real-time updates via PartyKit
  // member-joined/removed → auto-invalidates React Query cache
  // status-changed → redirect to bill page
  useRoomSocket(code, {
    onStatusChanged: (status) => {
      if (status === "splitting") {
        router.push(`/quick-split/${code}/bill`);
      }
    },
  });

  const room = data?.room;
  const currentMemberId = data?.currentMemberId;
  const members = room?.members ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;

  // Advance status mutation
  const advanceStatus = useAdvanceRoomStatus(room?.id ?? "");

  // Remove member (host kicks a guest)
  const removeMember = useRemoveMember(room?.id ?? "");

  // Add placeholder member (host adds a name manually)
  const addPlaceholder = useAddPlaceholderMember(room?.id ?? "");
  const [showAddMember, setShowAddMember] = useState(false);
  const [placeholderName, setPlaceholderName] = useState("");

  const handleAddPlaceholder = () => {
    if (!placeholderName.trim()) return;
    if (members.length >= (room?.expectedMembers ?? 0)) {
      toast.error("Room is full! Can't add more people 🙅");
      return;
    }
    addPlaceholder.mutate(
      { displayName: placeholderName.trim() },
      {
        onSuccess: () => {
          setPlaceholderName("");
          setShowAddMember(false);
        },
        onError: (err) => {
          if (err.message.includes("full")) {
            toast.error("Room is full! Can't add more people 🙅");
          } else if (err.message.includes("Name") || err.message.includes("name")) {
            toast.error("That name's already taken!");
          } else {
            toast.error("Couldn't add — try again");
          }
        },
      }
    );
  };

  const handleStartSplitting = () => {
    if (!room) return;
    advanceStatus.mutate("splitting", {
      onSuccess: () => {
        router.push(`/quick-split/${code}/bill`);
      },
      onError: () => {
        toast.error("Couldn't start splitting — try again 😬");
      },
    });
  };

  const handleShareLink = async () => {
    const joinUrl = `${window.location.origin}/quick-split/${code}/join`;
    if (navigator.share) {
      await navigator.share({ title: "Join my bill split!", url: joinUrl });
    } else {
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Link copied! Share it with your friends 🔗");
    }
  };

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading room...</p>
      </div>
    );
  }

  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quick-split/${code}/join`;
  const joinedCount = members.length;
  const expectedCount = room.expectedMembers;

  return (
    <div className="flex min-h-svh flex-col items-center px-6 py-8 md:py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* Member count */}
        <div className="text-center">
          <div className="font-heading text-4xl font-semibold text-gray-800 md:text-5xl">
            <span>{joinedCount}</span>
            <span className="text-lg font-normal text-gray-400 md:text-xl">
              /{expectedCount}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 md:text-base">
            Members Joined
          </p>
        </div>

        {/* QR Code */}
        {isHost && (
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <QRCodeSVG
              value={joinUrl}
              size={200}
              level="M"
              className="h-auto w-full max-w-[200px] md:max-w-[240px]"
            />
          </div>
        )}

        <p className="text-center text-sm text-gray-500 md:text-base">
          Scan QR code to join room or share link
        </p>
        <p className="break-all text-center text-xs text-gray-400">{joinUrl}</p>

        {/* Member grid */}
        <div className="grid w-full grid-cols-3 gap-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="relative rounded-lg border border-gray-200 bg-white px-3 py-2 text-center text-xs font-medium text-gray-700 md:text-sm"
            >
              {member.displayName}
              {member.isHost && (
                <span className="text-gray-400"> (host)</span>
              )}
              {isHost && !member.isHost && (
                <button
                  type="button"
                  onClick={() => removeMember.mutate(member.id, {
                    onError: () => toast.error("Couldn't remove — try again"),
                  })}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-[10px] text-white transition-colors hover:bg-red-500"
                  title={`Remove ${member.displayName}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {/* Waiting slots */}
          {Array.from({ length: Math.max(0, expectedCount - joinedCount) }).map(
            (_, i) => (
              <div
                key={`waiting-${i}`}
                className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-center text-xs text-gray-400 md:text-sm"
              >
                Waiting...
              </div>
            )
          )}
        </div>

        {/* Actions (host only) */}
        {isHost && (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleShareLink}
              className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 md:px-8 md:text-base"
            >
              Share Invite Link
            </button>

            {/* Add placeholder member */}
            {!showAddMember ? (
              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="text-sm text-gray-500 underline transition-colors hover:text-gray-800 md:text-base"
              >
                Add placeholder member
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={placeholderName}
                  onChange={(e) => setPlaceholderName(e.target.value)}
                  placeholder="Name"
                  className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddPlaceholder();
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddPlaceholder}
                  disabled={!placeholderName.trim() || addPlaceholder.isPending}
                  className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setPlaceholderName("");
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Start splitting */}
            <button
              type="button"
              onClick={handleStartSplitting}
              disabled={members.length < 2 || advanceStatus.isPending}
              className="mt-4 rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 md:px-10 md:py-3 md:text-base"
            >
              {advanceStatus.isPending ? "Starting..." : "Start Bill Splitting"}
            </button>
          </div>
        )}

        {/* Non-host view */}
        {!isHost && currentMemberId && (
          <p className="text-center text-sm text-gray-500">
            Waiting for the host to start splitting...
          </p>
        )}

        {/* Not a member yet — direct them to join */}
        {!currentMemberId && (
          <button
            type="button"
            onClick={() => router.push(`/quick-split/${code}/join`)}
            className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            Join this room
          </button>
        )}
      </div>
    </div>
  );
}
