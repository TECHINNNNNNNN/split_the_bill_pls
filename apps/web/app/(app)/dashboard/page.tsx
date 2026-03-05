"use client";

import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { groupQueries } from "@/lib/queries/groups";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import Image from "next/image";
import Link from "next/link";

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: groups, isLoading, error } = useQuery(groupQueries.all());
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            สวัสดี, {session?.user.name?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-gray-500">{session?.user.email}</p>
        </div>
        {session?.user.image && (
          <Image
            src={session.user.image}
            alt="avatar"
            width={40}
            height={40}
            referrerPolicy="no-referrer"
            className="rounded-full"
            unoptimized
          />
        )}
      </div>

      {/* Groups section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Your Groups</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateGroup(true)}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            + New
          </button>
          <button
            onClick={() => signOut()}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Loading groups...</p>
      ) : error ? (
        <p className="text-red-500">Failed to load groups</p>
      ) : groups?.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
          <p className="text-gray-400">No groups yet</p>
          <p className="mt-1 text-sm text-gray-300">
            Create a group to start splitting bills
          </p>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="mt-4 rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Create your first group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups?.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h3 className="font-semibold">{group.name}</h3>
              <p className="text-sm text-gray-500">
                {group.members.length} member
                {group.members.length !== 1 && "s"}
              </p>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
    </div>
  );
}
