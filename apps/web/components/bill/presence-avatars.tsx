"use client";

import type { PresenceUser } from "@/lib/hooks/use-presence";
import { getCursorColor } from "@/lib/hooks/use-presence";

interface PresenceAvatarsProps {
  onlineUsers: PresenceUser[];
  members: { id: string; displayName: string; user?: { image: string | null } | null }[];
  currentMemberId: string;
}

const MAX_VISIBLE = 3;

export function PresenceAvatars({ onlineUsers, members, currentMemberId }: PresenceAvatarsProps) {
  if (onlineUsers.length === 0) return null;

  const sorted = [...onlineUsers].sort((a, b) => {
    if (a.memberId === currentMemberId) return -1;
    if (b.memberId === currentMemberId) return 1;
    return 0;
  });

  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflowCount = onlineUsers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user) => {
        const color = getCursorColor(user.memberId, members);
        const isYou = user.memberId === currentMemberId;
        const member = members.find((m) => m.id === user.memberId);
        const image = member?.user?.image;
        const initial = user.displayName.charAt(0).toUpperCase();

        return image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={user.memberId}
            src={image}
            alt={user.displayName}
            className={`h-6 w-6 rounded-full border-2 border-cream object-cover transition-all ${
              isYou ? "ring-1 ring-brand-700" : ""
            }`}
            title={isYou ? `${user.displayName} (you)` : user.displayName}
          />
        ) : (
          <div
            key={user.memberId}
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-cream text-[9px] font-bold text-cream-light transition-all ${
              isYou ? "ring-1 ring-brand-700" : ""
            }`}
            style={{ backgroundColor: color }}
            title={isYou ? `${user.displayName} (you)` : user.displayName}
          >
            {initial}
          </div>
        );
      })}
      {overflowCount > 0 && (
        <div
          className="flex h-6 items-center justify-center rounded-full border-2 border-cream bg-brand-300 px-1.5 text-[9px] font-bold text-cream-light"
          title={sorted.slice(MAX_VISIBLE).map((u) => u.displayName).join(", ")}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
