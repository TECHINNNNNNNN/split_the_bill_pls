"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { roomQueries } from "@/lib/queries/rooms";
import { useJoinRoom } from "@/lib/mutations/rooms";
import { Skeleton } from "@/components/skeleton";

export default function JoinRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery(roomQueries.byCode(code));
  const joinRoom = useJoinRoom(code);

  const room = data?.room;

  const handleJoin = () => {
    if (!name.trim()) return;
    setError("");

    joinRoom.mutate(
      { displayName: name.trim() },
      {
        onSuccess: () => {
          router.push(`/quick-split/${code}`);
        },
        onError: (err) => {
          setError(err.message || "Failed to join room");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-32 rounded-full" />
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="font-medium">Room not found</p>
        <p className="mt-2 text-sm text-brand-400">
          This room may have expired or the code is invalid.
        </p>
      </div>
    );
  }

  if (room.status !== "waiting") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="font-medium">Room already started</p>
        <p className="mt-2 text-sm text-brand-400">
          This room has already begun splitting. Ask the host to add you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="font-caveat text-4xl font-bold md:text-5xl">
            Join Room
          </h1>
          <p className="mt-2 font-serif text-sm italic text-brand-400 md:text-base">
            {room.name || `${room.hostName}'s bill split`}
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <label
            htmlFor="join-name"
            className="font-caveat text-lg font-medium md:text-xl"
          >
            Your name
          </label>
          <input
            id="join-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Opal"
            className="w-full rounded-xl border border-brand-200 bg-cream-light px-4 py-3 text-center text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none md:text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        <button
          type="button"
          onClick={handleJoin}
          disabled={!name.trim() || joinRoom.isPending}
          className="rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-brand-700 md:text-base"
        >
          {joinRoom.isPending ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}
