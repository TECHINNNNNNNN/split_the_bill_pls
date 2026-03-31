"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { groupQueries } from "@/lib/queries/groups";
import { useDeleteGroupMember, useDeleteGroup, useStartGroupSplit } from "@/lib/mutations/groups";
import { useGroupSocket } from "@/lib/hooks/use-group-socket";
import { toast } from "sonner";
import { Skeleton } from "@/components/skeleton";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  useGroupSocket(id);
  const { data: group, isLoading, error } = useQuery(groupQueries.detail(id));

  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const deleteMember = useDeleteGroupMember(id);
  const deleteGroup = useDeleteGroup();
  const startSplit = useStartGroupSplit(id);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-3 h-9 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
        <Skeleton className="mt-6 h-14 rounded-2xl" />
        <Skeleton className="mt-3 h-14 rounded-2xl" />
        <Skeleton className="mt-6 h-6 w-24" />
        <Skeleton className="mt-3 h-14 rounded-2xl" />
        <Skeleton className="mt-2 h-14 rounded-2xl" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex flex-col items-center pt-16 text-center">
        <p className="font-caveat text-2xl text-error">Group not found</p>
        <button
          onClick={() => router.push("/home")}
          className="mt-6 rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
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
            className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          {isCreator && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-sm text-brand-400 hover:text-brand-700"
            >
              {showSettings ? "Done" : "Settings"}
            </button>
          )}
        </div>
        <h1 className="font-caveat text-3xl font-bold">{group.name}</h1>
        <p className="text-sm text-brand-400">
          {group.members.length} member{group.members.length !== 1 && "s"}
        </p>
      </div>

      {/* Settings Panel */}
      {showSettings && isCreator && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
          <h3 className="font-caveat text-lg font-semibold">Group Settings</h3>
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-700">
              Deleting this group will permanently remove all members, bills, and payment records.
            </p>
            <button
              onClick={handleDeleteGroup}
              disabled={deleteGroup.isPending}
              className="rounded-xl bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-200 active:scale-[0.97] disabled:opacity-40"
            >
              {deleteGroup.isPending ? "Deleting..." : "Delete Group"}
            </button>
          </div>
        </div>
      )}

      {/* Share invite link */}
      <button
        onClick={handleShareLink}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300 bg-cream-light py-4 text-sm text-brand-500 shadow-sm transition-all hover:border-brand-400 hover:bg-cream active:scale-[0.99]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Share invite link · Code: {group.inviteCode}
      </button>

      {/* Start Split CTA */}
      {!showSplitPicker && group.members.length > 1 && (
        <button
          onClick={() => {
            setSelectedIds(new Set(group.members.map(m => m.id)));
            setShowSplitPicker(true);
          }}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-4 font-caveat text-xl font-medium text-cream-light shadow-md transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Start a Split
        </button>
      )}

      {/* Member Picker for Split */}
      {showSplitPicker && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-caveat text-lg font-semibold">Who&apos;s splitting?</h3>
            <button
              onClick={toggleAll}
              className="text-sm text-brand-400 hover:text-brand-600"
            >
              {selectedIds.size === group.members.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <p className="mb-3 font-serif text-xs italic text-brand-300">
            Selected members will be invited to join the split room.
          </p>

          <ul className="mb-4 space-y-1">
            {group.members.map((member) => (
              <li key={member.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-cream">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="h-4 w-4 rounded border-brand-300 accent-brand-700"
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
              className="flex-1 rounded-xl bg-brand-700 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97] disabled:opacity-40"
            >
              {startSplit.isPending ? "Creating..." : `Split with ${selectedIds.size}`}
            </button>
            <button
              onClick={() => setShowSplitPicker(false)}
              className="rounded-xl border border-brand-200 px-4 py-2.5 text-sm text-brand-400 transition-all hover:bg-cream active:scale-[0.97]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Members */}
      <section className="mb-8">
        <h2 className="font-caveat text-xl font-semibold mb-3">Members</h2>

        {group.members.length === 0 ? (
          <p className="font-serif text-sm italic text-brand-300">
            No members yet. Share the invite link above.
          </p>
        ) : (
          <div className="rounded-2xl border border-brand-200 bg-cream-light shadow-sm overflow-hidden">
            {group.members.map((member, i) => (
              <div
                key={member.id}
                className={`flex items-center justify-between px-4 py-3 ${i < group.members.length - 1 ? "border-b border-brand-100" : ""}`}
              >
                <span className="text-sm font-medium">
                  {member.displayName}
                </span>
                {isCreator && member.userId !== session?.user.id && (
                  <button
                    onClick={() => handleDeleteMember(member.id, member.displayName)}
                    className="text-xs text-brand-300 transition-colors hover:text-error"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}