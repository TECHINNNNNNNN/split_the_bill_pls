"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { roomQueries } from "@/lib/queries/rooms";
import { useAdvanceRoomStatus, useAddPlaceholderMember, useRemoveMember } from "@/lib/mutations/rooms";
import { useRoomSocket } from "@/lib/hooks/use-room-socket";
import { useLiff } from "@/lib/hooks/use-liff";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { buildInviteFlexMessage } from "@/lib/liff-messages";
import { Skeleton } from "@/components/skeleton";

// ─── Main component ───

export default function RoomLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  // Fetch room data
  const { data, isLoading, error } = useQuery(roomQueries.byCode(code));

  // WebSocket: real-time updates via PartyKit
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

  const advanceStatus = useAdvanceRoomStatus(room?.id ?? "");
  const removeMember = useRemoveMember(room?.id ?? "");
  const addPlaceholder = useAddPlaceholderMember(room?.id ?? "");
  const [showAddMember, setShowAddMember] = useState(false);
  const [placeholderName, setPlaceholderName] = useState("");

  const liff = useLiff();
  useWakeLock(isHost && !!room);

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
      roomName: room.name || `${room.hostName}'s Split`,
      hostName: hostMember?.displayName ?? room.hostName ?? "Host",
      total: 0,
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

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center px-6 py-8 md:py-16">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          {/* Count skeleton */}
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          {/* QR skeleton */}
          <Skeleton className="h-[230px] w-[230px] rounded-2xl" />
          <Skeleton className="h-4 w-48" />
          {/* Member grid skeleton */}
          <div className="grid w-full grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          {/* Button skeleton */}
          <Skeleton className="h-12 w-48 rounded-full" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6">
        <p className="font-medium">
          {error ? "Failed to load room" : "Room not found"}
        </p>
        <p className="text-sm text-brand-400">
          {error ? "Check your connection and try again." : "This room may have expired or the code is invalid."}
        </p>
        {error && (
          <p className="mt-2 max-w-xs break-all text-xs text-error">
            {error.message}
          </p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full border border-brand-200 px-6 py-2 text-sm font-medium transition-all hover:bg-cream-light active:scale-[0.98]"
        >
          Retry
        </button>
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
          <div className="font-heading text-4xl font-semibold md:text-5xl">
            <span>{joinedCount}</span>
            <span className="text-lg font-normal text-brand-300 md:text-xl">
              /{expectedCount}
            </span>
          </div>
          <p className="mt-1 font-caveat text-lg text-brand-400 md:text-xl">
            Members Joined
          </p>
        </div>

        {/* QR Code — tap to copy link */}
        {isHost && (
          <button
            type="button"
            onClick={handleCopyLink}
            className="group relative rounded-2xl border border-brand-100 bg-cream-light p-5 shadow-sm transition-shadow hover:shadow-md active:shadow-sm"
            title="Tap to copy invite link"
          >
            <QRCodeSVG
              value={joinUrl}
              size={200}
              level="M"
              fgColor="#3d2810"
              bgColor="transparent"
              className="h-auto w-full max-w-[200px] md:max-w-[240px]"
            />
            <span className="absolute inset-0 flex items-end justify-center rounded-2xl bg-black/0 pb-3 text-[11px] font-medium text-transparent transition-all group-hover:bg-brand-800/5 group-hover:text-brand-400">
              Tap to copy link
            </span>
          </button>
        )}

        <p className="text-center text-sm text-brand-400 md:text-base">
          Scan QR code to join room or share link
        </p>
        <button
          type="button"
          onClick={handleCopyLink}
          className="group flex items-center gap-1.5 break-all text-center text-xs text-brand-300 transition-colors hover:text-brand-500 active:text-brand-700"
          title="Tap to copy"
        >
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
              className="relative rounded-xl border border-brand-200 bg-cream-light px-3 py-2.5 text-center text-xs font-medium md:text-sm"
            >
              {member.displayName}
              {member.isHost && (
                <span className="text-brand-300"> (host)</span>
              )}
              {isHost && !member.isHost && (
                <button
                  type="button"
                  onClick={() => removeMember.mutate(member.id, {
                    onError: () => toast.error("Couldn't remove — try again"),
                  })}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-300 text-[10px] text-cream-light transition-colors hover:bg-error"
                  title={`Remove ${member.displayName}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, expectedCount - joinedCount) }).map(
            (_, i) => (
              <div
                key={`waiting-${i}`}
                className="rounded-xl border border-dashed border-brand-200 px-3 py-2.5 text-center text-xs text-brand-300 md:text-sm"
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
                className="rounded-full border border-brand-200 px-6 py-2.5 text-sm font-medium transition-all hover:bg-cream-light active:scale-[0.98] md:px-8 md:text-base"
              >
                Share Invite Link
              </button>
              {liff.isSupported && (
                <button
                  type="button"
                  onClick={handleShareLine}
                  disabled={!liff.isReady}
                  className="flex items-center gap-1.5 rounded-full bg-[#06C755] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40 md:px-6 md:text-base"
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
                className="font-caveat text-base text-brand-400 underline transition-colors hover:text-brand-600 md:text-lg"
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
                  className="w-32 rounded-xl border border-brand-200 bg-cream-light px-3 py-1.5 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddPlaceholder();
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddPlaceholder}
                  disabled={!placeholderName.trim() || addPlaceholder.isPending}
                  className="rounded-xl bg-brand-700 px-3 py-1.5 text-sm text-cream-light disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMember(false);
                    setPlaceholderName("");
                  }}
                  className="text-sm text-brand-300 hover:text-brand-500"
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
              className="mt-4 rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-700 md:text-base"
            >
              {advanceStatus.isPending ? "Starting..." : "Start Bill Splitting"}
            </button>
          </div>
        )}

        {/* Non-host view */}
        {!isHost && currentMemberId && (
          <p className="text-center font-caveat text-base text-brand-400">
            Waiting for the host to start splitting...
          </p>
        )}

        {/* Not a member yet — direct them to join */}
        {!currentMemberId && (
          <button
            type="button"
            onClick={() => router.push(`/quick-split/${code}/join`)}
            className="rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
          >
            Join this room
          </button>
        )}
      </div>
    </div>
  );
}
