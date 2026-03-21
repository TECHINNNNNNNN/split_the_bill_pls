"use client";

import type { PresenceUser } from "@/lib/hooks/use-presence";
import { getCursorColor } from "@/lib/hooks/use-presence";

interface PresenceAvatarsProps {
  onlineUsers: PresenceUser[];
  members: { id: string; displayName: string }[];
  currentMemberId: string;
}

export function PresenceAvatars({ onlineUsers, members, currentMemberId }: PresenceAvatarsProps) {
  if (onlineUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {onlineUsers.map((user) => {
        const color = getCursorColor(user.memberId, members);
        const isYou = user.memberId === currentMemberId;
        const initial = user.displayName.charAt(0).toUpperCase();

        return (
          <div
            key={user.memberId}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white transition-all ${
              isYou ? "ring-2 ring-gray-800 ring-offset-1" : ""
            }`}
            style={{ backgroundColor: color }}
            title={isYou ? `${user.displayName} (you)` : user.displayName}
          >
            {initial}
          </div>
        );
      })}
    </div>
  );
}
