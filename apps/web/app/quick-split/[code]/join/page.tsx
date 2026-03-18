"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { roomQueries } from "@/lib/queries/rooms";
import { useJoinRoom } from "@/lib/mutations/rooms";

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
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="text-gray-800">Room not found</p>
        <p className="mt-2 text-sm text-gray-500">
          This room may have expired or the code is invalid.
        </p>
      </div>
    );
  }

  if (room.status !== "waiting") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center px-6">
        <p className="text-gray-800">Room already started</p>
        <p className="mt-2 text-sm text-gray-500">
          This room has already begun splitting. Ask the host to add you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-gray-800 md:text-3xl">
            Join Room
          </h1>
          <p className="mt-1 text-sm text-gray-500 md:text-base">
            {room.hostName}&apos;s bill split
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <label
            htmlFor="join-name"
            className="text-sm font-medium text-gray-800 md:text-base"
          >
            Your name
          </label>
          <input
            id="join-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Opal"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none md:py-3 md:text-base"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />
        </div>

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        <button
          type="button"
          onClick={handleJoin}
          disabled={!name.trim() || joinRoom.isPending}
          className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 md:px-10 md:py-3 md:text-base"
        >
          {joinRoom.isPending ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}
