"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { roomQueries } from "@/lib/queries/rooms";
import { useAdvanceRoomStatus, useAddPlaceholderMember, useRemoveMember } from "@/lib/mutations/rooms";
import { useRoomSocket } from "@/lib/hooks/use-room-socket";
import { useLiff } from "@/lib/hooks/use-liff";
import { buildInviteFlexMessage } from "@/lib/liff-messages";

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

  // LINE LIFF sharing
  const liff = useLiff();

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

  const handleShareLine = async () => {
    if (!room) return;
    const joinUrl = `${window.location.origin}/quick-split/${code}/join`;
    const hostMember = members.find((m) => m.isHost);

    const message = buildInviteFlexMessage({
      roomName: room.hostName ? `${room.hostName}'s Split` : "Bill Split",
      hostName: hostMember?.displayName ?? room.hostName ?? "Host",
      total: 0, // not finalized yet at lobby stage
      memberCount: room.expectedMembers,
      joinUrl,
    });

    try {
      const result = await liff.shareTargetPicker([message]);
      if (result) {
        toast.success("Shared to LINE! 💚");
      }
    } catch (err) {
      console.error("[liff] Share failed:", err);
      toast.error("Couldn't share to LINE — try copying the link instead");
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareLink}
                className="rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 md:px-8 md:text-base"
              >
                Share Invite Link
              </button>
              {liff.isSupported && (
                <button
                  type="button"
                  onClick={handleShareLine}
                  disabled={!liff.isReady}
                  className="flex items-center gap-1.5 rounded-full bg-[#06C755] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 md:px-6 md:text-base"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  LINE
                </button>
              )}
            </div>

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
