"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { groupQueries } from "@/lib/queries/groups";
import { useDeleteGroupMember, useDeleteGroup, useStartGroupSplit } from "@/lib/mutations/groups";
import { useGroupSocket } from "@/lib/hooks/use-group-socket";
import toast from "react-hot-toast";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  // Real-time: auto-refresh when new members join
  useGroupSocket(id);
  const { data: group, isLoading, error } = useQuery(groupQueries.detail(id));

  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const deleteMember = useDeleteGroupMember(id);
  const deleteGroup = useDeleteGroup();
  const startSplit = useStartGroupSplit(id);

  if (isLoading) {
    return <p className="text-gray-400">Loading group...</p>;
  }

  if (error || !group) {
    return (
      <div className="text-center">
        <p className="text-red-500">Group not found</p>
        <button
          onClick={() => router.push("/home")}
          className="mt-2 text-sm text-gray-500 underline"
        >
          Back to home
        </button>
      </div>
    );
  }

  const isCreator = group.createdBy === session?.user.id;

  const handleDeleteMember = (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the group?`)) return;

    deleteMember.mutate(memberId, {
      onSuccess: () => toast.success(`${name} removed`),
      onError: () => toast.error("Failed to remove member"),
    });
  };

  const handleDeleteGroup = () => {
    if (!confirm(`Delete "${group.name}"? This will remove all members and bills. This cannot be undone.`)) return;

    deleteGroup.mutate(id, {
      onSuccess: () => {
        toast.success("Group deleted");
        router.push("/home");
      },
      onError: () => toast.error("Failed to delete group"),
    });
  };

  const handleShareLink = async () => {
    const url = `${window.location.origin}/groups/join/${group.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied!");
    } catch {
      // Fallback: show the code
      toast.success(`Code: ${group.inviteCode}`);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === group.members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(group.members.map(m => m.id)));
    }
  };

  const handleStartSplit = () => {
    startSplit.mutate(
      { memberIds: Array.from(selectedIds) },
      {
        onSuccess: (data) => {
          router.push(`/quick-split/${data.inviteCode}`);
        },
        onError: () => {
          toast.error("Failed to start split");
        },
      }
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => router.push("/home")}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            &larr; Back
          </button>
          {isCreator && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Settings
            </button>
          )}
        </div>
        <h1 className="font-heading text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-gray-500">
          {group.members.length} member{group.members.length !== 1 && "s"}
        </p>
      </div>

      {/* Settings Panel (creator only) */}
      {showSettings && isCreator && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="font-heading mb-3 font-semibold">Group Settings</h3>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-700">
              Deleting this group will permanently remove all members, bills, and payment records.
            </p>
            <button
              onClick={handleDeleteGroup}
              disabled={deleteGroup.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              {deleteGroup.isPending ? "Deleting..." : "Delete Group"}
            </button>
          </div>
        </div>
      )}

      {/* Invite Friends */}
      <button
        onClick={handleShareLink}
        className="mb-4 w-full rounded-xl border border-dashed border-gray-300 py-3 text-center text-sm text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
      >
        Share invite link &middot; Code: {group.inviteCode}
      </button>

      {/* Start Split CTA */}
      {!showSplitPicker && group.members.length > 1 && (
        <button
          onClick={() => {
            setSelectedIds(new Set(group.members.map(m => m.id)));
            setShowSplitPicker(true);
          }}
          className="mb-6 w-full rounded-xl bg-gray-900 py-3 text-center font-medium text-white transition-colors hover:bg-gray-800"
        >
          Start a Split
        </button>
      )}

      {/* Member Picker for Split */}
      {showSplitPicker && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-heading font-semibold">Who&apos;s splitting?</h3>
            <button
              onClick={toggleAll}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              {selectedIds.size === group.members.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <p className="mb-3 text-xs text-gray-400">
            Selected members will be invited to join the split room.
          </p>

          <ul className="mb-4 space-y-2">
            {group.members.map((member) => (
              <li key={member.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm">{member.displayName}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <button
              onClick={handleStartSplit}
              disabled={selectedIds.size === 0 || startSplit.isPending}
              className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              {startSplit.isPending ? "Creating..." : `Split with ${selectedIds.size} member${selectedIds.size !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={() => setShowSplitPicker(false)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      <section className="mb-8">
        <h2 className="font-heading mb-3 text-lg font-semibold">Members</h2>

        {group.members.length === 0 ? (
          <p className="text-sm text-gray-400">
            No members yet. Share the invite link above.
          </p>
        ) : (
          <ul className="space-y-2">
            {group.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium">
                  {member.displayName}
                </span>
                {isCreator && member.userId !== session?.user.id && (
                  <button
                    onClick={() =>
                      handleDeleteMember(member.id, member.displayName)
                    }
                    className="text-xs text-gray-400 transition-colors hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
