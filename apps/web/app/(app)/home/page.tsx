"use client";

import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { groupQueries } from "@/lib/queries/groups";
import { roomQueries } from "@/lib/queries/rooms";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import Image from "next/image";
import Link from "next/link";

function roomHref(code: string, status: string) {
  switch (status) {
    case "splitting": return `/quick-split/${code}/bill`;
    case "payment":
    case "settled": return `/quick-split/${code}/tracking`;
    default: return `/quick-split/${code}`;
  }
}

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  splitting: "Splitting",
  payment: "Payment",
  settled: "Settled",
};

const STATUS_COLOR: Record<string, string> = {
  waiting: "bg-yellow-100 text-yellow-700",
  splitting: "bg-blue-100 text-blue-700",
  payment: "bg-orange-100 text-orange-700",
  settled: "bg-green-100 text-green-700",
};

export default function HomePage() {
  const { data: session } = useSession();
  const { data: groups, isLoading: groupsLoading } = useQuery(groupQueries.all());
  const { data: myRooms, isLoading: roomsLoading } = useQuery(roomQueries.my());
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {session?.user.name?.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-500">{session?.user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {session?.user.image && (
            <Image
              src={session.user.image}
              alt="avatar"
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              className="rounded-full"
              unoptimized
            />
          )}
          <button
            onClick={() => signOut()}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Quick Split CTA */}
      <Link
        href="/quick-split"
        className="mb-6 flex items-center justify-between rounded-xl bg-gray-900 p-4 text-white transition-colors hover:bg-gray-800"
      >
        <div>
          <p className="font-heading font-semibold">Quick Split</p>
          <p className="text-sm text-gray-400">No account needed for friends</p>
        </div>
        <span className="text-2xl">+</span>
      </Link>

      {/* Recent Splits */}
      <section className="mb-6">
        <h2 className="font-heading mb-3 text-lg font-semibold">Recent Splits</h2>
        {roomsLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : !myRooms?.length ? (
          <p className="text-sm text-gray-400">No splits yet. Start one above!</p>
        ) : (
          <div className="space-y-2">
            {myRooms.map((room) => (
              <Link
                key={room.id}
                href={roomHref(room.inviteCode, room.status)}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium">{room.hostName}</p>
                  <p className="text-xs text-gray-500">
                    {room.members.length} member{room.members.length !== 1 && "s"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[room.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {STATUS_LABEL[room.status] ?? room.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Groups */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Your Groups</h2>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            + New
          </button>
        </div>

        {groupsLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : !groups?.length ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
            <p className="text-gray-400">No groups yet</p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="mt-3 rounded-xl bg-gray-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Create your first group
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <h3 className="font-semibold">{group.name}</h3>
                <p className="text-sm text-gray-500">
                  {group.members.length} member{group.members.length !== 1 && "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
    </div>
  );
}
