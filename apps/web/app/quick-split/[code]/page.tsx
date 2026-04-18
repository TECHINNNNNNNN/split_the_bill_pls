"use client";

import { use, useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { getRoomRedirect } from "@/lib/utils/room-redirect";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { roomQueries } from "@/lib/queries/rooms";
import { useAdvanceRoomStatus, useAddPlaceholderMember, useRemoveMember } from "@/lib/mutations/rooms";
import { useRoomSocket } from "@/lib/hooks/use-room-socket";
import { useLiff } from "@/lib/hooks/use-liff";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";
import { buildInviteFlexMessage } from "@/lib/liff-messages";
import { Skeleton } from "@/components/skeleton";

// Warm avatar colors for member circles
const AVATAR_COLORS = [
  "bg-brand-700", "bg-amber-600", "bg-emerald-600", "bg-sky-600",
  "bg-rose-500", "bg-violet-600", "bg-orange-500", "bg-teal-600",
  "bg-pink-500", "bg-indigo-500", "bg-lime-600", "bg-cyan-600",
];

export default function RoomLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const { data, isLoading, error, isFetching } = useQuery(roomQueries.byCode(code));

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
  const [prevCount, setPrevCount] = useState(0);
  const [countDirection, setCountDirection] = useState(1);

  const liff = useLiff();
  useWakeLock(isHost && !!room);
  const pathname = usePathname();

  useEffect(() => {
    if (!room || isFetching) return;
    const redirect = getRoomRedirect(code, room.status, isHost, pathname);
    if (redirect) router.replace(redirect);
  }, [room, code, isHost, pathname, router, isFetching]);

  // Track member count direction for slot animation
  useEffect(() => {
    if (members.length !== prevCount) {
      setCountDirection(members.length > prevCount ? 1 : -1);
      setPrevCount(members.length);
    }
  }, [members.length, prevCount]);

  const handleAddPlaceholder = () => {
    if (!placeholderName.trim()) return;
    if (members.length >= (room?.expectedMembers ?? 0)) {
      toast.error("Room is full! Can't add more people 🙅");
      return;
    }
    addPlaceholder.mutate(
      { displayName: placeholderName.trim() },
      {
        onSuccess: () => { setPlaceholderName(""); setShowAddMember(false); },
        onError: (err) => {
          if (err.message.includes("full")) toast.error("Room is full! Can't add more people 🙅");
          else if (err.message.includes("name") || err.message.includes("Name")) toast.error("That name's already taken!");
          else toast.error("Couldn't add — try again");
        },
      }
    );
  };

  const handleStartSplitting = () => {
    if (!room) return;
    advanceStatus.mutate("splitting", {
      onError: () => toast.error("Couldn't start — try again"),
    });
  };

  const handleShareLink = async () => {
    const joinUrl = `${window.location.origin}/quick-split/${code}/join`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my PlaDuk room!", url: joinUrl });
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
      const liffModule = await import("@line/liff");
      await liffModule.default.shareTargetPicker([message]);
      toast.success("Invite sent via LINE! 🎉");
    } catch (err) {
      console.error("[liff] Share failed:", err);
      toast.error("Couldn't share to LINE — try copying the link instead");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center px-6 py-8 md:py-16">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[230px] w-[230px] rounded-2xl" />
          <Skeleton className="h-4 w-48" />
          <div className="grid w-full grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 w-48 rounded-full" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6">
        <p className="font-medium">{error ? "Failed to load room" : "Room not found"}</p>
        <p className="text-sm text-brand-400">
          {error ? "Check your connection and try again." : "This room may have expired or the code is invalid."}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-full border border-brand-200 px-6 py-2 text-sm font-medium transition-all hover:bg-cream-light active:scale-[0.98]">
          Retry
        </button>
      </div>
    );
  }

  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quick-split/${code}/join`;
  const joinedCount = members.length;
  const expectedCount = room.expectedMembers;
  const totalSlots = Math.max(expectedCount, joinedCount);
  const roomDisplayName = room.name || `${room.hostName}'s Split`;

  // Circle layout for ≤8, grid for 9+
  const useCircle = totalSlots <= 8;
  const CIRCLE_RADIUS = Math.min(65, 50 + totalSlots * 3);
  const slots = Array.from({ length: totalSlots }, (_, i) => {
    // Host always at position 0 (top). Others fill clockwise.
    const member = i < members.length ? members[i] : null;
    const angle = (i / totalSlots) * 360 - 90; // -90 so position 0 is at the top
    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * CIRCLE_RADIUS;
    const y = Math.sin(rad) * CIRCLE_RADIUS;
    return { member, x, y, index: i };
  });

  return (
    <div className="relative flex min-h-svh flex-col items-center px-6 py-8 md:py-16">
      {/* Corner ornaments */}
      <svg className="pointer-events-none absolute left-6 top-6 h-12 w-12" viewBox="0 0 65 65" fill="none">
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </svg>
      <svg className="pointer-events-none absolute bottom-6 right-6 h-12 w-12 rotate-180" viewBox="0 0 65 65" fill="none">
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </svg>

      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Room name + invite code */}
        <h1 className="font-caveat text-2xl font-bold md:text-3xl">{roomDisplayName}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-3 py-0.5 text-[11px] font-medium tracking-wider text-brand-500">
            {room.inviteCode}
          </span>
        </div>
        {/* Organic underline */}
        <svg className="mt-2 h-[3px] w-16" viewBox="0 0 64 3" fill="none">
          <path d="M 1 1.5 C 12 0.5, 28 2.5, 40 1 S 56 2, 63 1.5" stroke="#C4956A" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
        </svg>

        {/* QR Code with pulsing shadow */}
        {isHost && (
          <motion.button
            type="button"
            onClick={handleCopyLink}
            className="group relative mt-6 rounded-2xl border border-brand-100 bg-cream-light p-5"
            title="Tap to copy invite link"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(196,149,106,0)",
                "0 0 0 14px rgba(196,149,106,0.1)",
                "0 0 0 0 rgba(196,149,106,0)",
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
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
          </motion.button>
        )}

        <p className="mt-5 text-center text-xs text-brand-300">
          Scan to join · tap QR to copy link
        </p>

        {/* ─── Members — circle for ≤8, grid for 9+ ─── */}

        {/* Count */}
        <div className="mt-3 flex flex-col items-center">
          <div className="flex items-baseline gap-0.5">
            <div className="relative overflow-hidden" style={{ width: "2rem", height: "2rem" }}>
              <AnimatePresence mode="popLayout" custom={countDirection}>
                <motion.span
                  key={joinedCount}
                  custom={countDirection}
                  initial={{ y: countDirection * 16, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: countDirection * -16, opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute inset-0 flex items-center justify-center font-heading text-2xl font-bold"
                >
                  {joinedCount}
                </motion.span>
              </AnimatePresence>
            </div>
            <span className="font-heading text-lg font-normal text-brand-300">/{expectedCount}</span>
          </div>
          <span className="text-[9px] tracking-wider text-brand-300">JOINED</span>
        </div>

        {useCircle ? (
          /* Circle layout */
          <div className="relative mt-2 flex items-center justify-center" style={{ width: CIRCLE_RADIUS * 2 + 60, height: CIRCLE_RADIUS * 2 + 60 }}>
            {slots.map(({ member, x, y, index }) => (
              <div
                key={member?.id ?? `empty-${index}`}
                className="absolute flex flex-col items-center"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              >
                {member ? (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: index * 0.05 }}
                    className="relative flex flex-col items-center"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-cream-light shadow-sm ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="mt-0.5 max-w-[56px] truncate text-center text-[9px] font-medium">
                      {member.displayName}
                      {member.isHost && <span className="text-brand-300"> ★</span>}
                    </span>
                    {isHost && !member.isHost && (
                      <button
                        type="button"
                        onClick={() => removeMember.mutate(member.id, { onError: () => toast.error("Couldn't remove — try again") })}
                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-300 text-[8px] text-cream-light transition-colors hover:bg-error"
                      >
                        ✕
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    className="flex flex-col items-center"
                    animate={{ opacity: [0.25, 0.45, 0.25] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.3, ease: "easeInOut" }}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-brand-200">
                      <span className="text-[10px] text-brand-200">?</span>
                    </div>
                    <span className="mt-0.5 text-[9px] text-brand-200">...</span>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Grid layout for 9+ members */
          <div className="mt-4 grid w-full grid-cols-4 gap-2">
            {slots.map(({ member, index }) => (
              <div key={member?.id ?? `empty-${index}`} className="flex flex-col items-center">
                {member ? (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: index * 0.03 }}
                    className="relative flex flex-col items-center"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-cream-light shadow-sm ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span className="mt-0.5 max-w-[52px] truncate text-center text-[9px] font-medium">
                      {member.displayName}
                      {member.isHost && <span className="text-brand-300"> ★</span>}
                    </span>
                    {isHost && !member.isHost && (
                      <button
                        type="button"
                        onClick={() => removeMember.mutate(member.id, { onError: () => toast.error("Couldn't remove") })}
                        className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-300 text-[7px] text-cream-light hover:bg-error"
                      >
                        ✕
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    className="flex flex-col items-center"
                    animate={{ opacity: [0.25, 0.45, 0.25] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.15, ease: "easeInOut" }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-brand-200">
                      <span className="text-[9px] text-brand-200">?</span>
                    </div>
                    <span className="mt-0.5 text-[8px] text-brand-200">...</span>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Actions (host only) ─── */}
        {isHost && (
          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareLink}
                className="rounded-full border border-brand-200 px-6 py-2.5 text-sm font-medium transition-all hover:bg-cream-light active:scale-[0.98]"
              >
                Share Link
              </button>
              {liff.isSupported && (
                <button
                  type="button"
                  onClick={handleShareLine}
                  disabled={!liff.isReady}
                  className="flex items-center gap-1.5 rounded-full bg-[#5a9e6e] px-5 py-2.5 text-sm font-medium text-cream-light shadow-sm transition-all hover:bg-[#4e8c60] active:scale-[0.97] disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                  </svg>
                  LINE
                </button>
              )}
            </div>

            {/* Add placeholder member */}
            <AnimatePresence mode="popLayout">
              {!showAddMember ? (
                <motion.button
                  key="trigger"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  type="button"
                  onClick={() => setShowAddMember(true)}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-brand-200 px-4 py-1.5 text-xs text-brand-400 transition-all hover:border-brand-400 hover:text-brand-600 active:scale-[0.97]"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4-4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M19 8v6M22 11h-6" />
                  </svg>
                  Add someone manually
                </motion.button>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="flex items-center gap-2 rounded-full border border-brand-200 bg-cream-light px-1.5 py-1"
                >
                  <input
                    type="text"
                    value={placeholderName}
                    onChange={(e) => setPlaceholderName(e.target.value)}
                    placeholder="Their name"
                    className="w-28 bg-transparent px-2.5 py-1 text-sm placeholder:text-brand-300 focus:outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddPlaceholder(); }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddPlaceholder}
                    disabled={!placeholderName.trim() || addPlaceholder.isPending}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-cream-light transition-all active:scale-90 disabled:opacity-30"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round">
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddMember(false); setPlaceholderName(""); }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-brand-300 transition-all hover:bg-brand-100 hover:text-brand-500"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start splitting — glows when ready */}
            <motion.button
              type="button"
              onClick={handleStartSplitting}
              disabled={members.length < 2 || advanceStatus.isPending}
              className={`mt-4 rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-700 md:text-base ${members.length >= 2 ? "animate-border-glow" : ""}`}
            >
              {advanceStatus.isPending ? "Starting..." : "Start Bill Splitting"}
            </motion.button>
          </div>
        )}

        {/* Non-host waiting message */}
        {!isHost && currentMemberId && (
          <p className="mt-6 text-center font-caveat text-base text-brand-400">
            Waiting for the host to start splitting...
          </p>
        )}

        {/* Not a member — join button */}
        {!currentMemberId && (
          <button
            type="button"
            onClick={() => router.push(`/quick-split/${code}/join`)}
            className="mt-6 rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
          >
            Join this room
          </button>
        )}
      </div>
    </div>
  );
}
