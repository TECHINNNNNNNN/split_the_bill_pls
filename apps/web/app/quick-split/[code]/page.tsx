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
      try {
        await navigator.share({ title: "Join my bill split!", url: joinUrl });
      } catch (err) {
        // User cancelled the share dialog — not an error
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    } else {
      await navigator.clipboard.writeText(joinUrl);
      toast.success("Link copied! Share it with your friends 🔗");
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/quick-split/${code}/join`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied! 🔗");
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

        {/* QR Code — tap to copy link */}
        {isHost && (
          <button
            type="button"
            onClick={handleCopyLink}
            className="group relative rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md active:shadow-sm"
            title="Tap to copy invite link"
          >
            <QRCodeSVG
              value={joinUrl}
              size={200}
              level="M"
              className="h-auto w-full max-w-[200px] md:max-w-[240px]"
            />
            {/* Copy hint overlay */}
            <span className="absolute inset-0 flex items-end justify-center rounded-xl bg-black/0 pb-2 text-[11px] font-medium text-transparent transition-all group-hover:bg-black/5 group-hover:text-gray-500">
              Tap to copy link
            </span>
          </button>
        )}

        <p className="text-center text-sm text-gray-500 md:text-base">
          Scan QR code to join room or share link
        </p>
        <button
          type="button"
          onClick={handleCopyLink}
          className="group flex items-center gap-1.5 break-all text-center text-xs text-gray-400 transition-colors hover:text-gray-600 active:text-gray-800"
          title="Tap to copy"
        >
          {/* Copy icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          >
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
            <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
          </svg>
          {joinUrl}
        </button>

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
