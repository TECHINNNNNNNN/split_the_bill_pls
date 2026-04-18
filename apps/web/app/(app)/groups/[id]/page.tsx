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


const COLORS = ["#8B6914", "#B08A56", "#6D8B5E", "#C49A3C", "#9B7A6E", "#6A8BA0", "#C47A5A", "#A06B7A"];

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
        <Skeleton className="mt-4 h-32 rounded-2xl" />
        <Skeleton className="mt-4 h-14 rounded-2xl" />
        <Skeleton className="mt-6 h-6 w-24" />
        <Skeleton className="mt-3 h-16 rounded-2xl" />
        <Skeleton className="mt-2 h-16 rounded-2xl" />
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
      {/* Back + Settings */}
      <div className="mb-4 flex animate-item-fade items-center justify-between">
        <button
          onClick={() => router.push("/home")}
          className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18L9 12L15 6" />
          </svg>
          Back
        </button>
        {isCreator && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            {showSettings ? "Done" : "Settings"}
          </button>
        )}
      </div>

      {/* Group identity — minimal, typographic */}
      <div
        className="mb-6"
      >
        {/* Name + avatars on same line */}
        <div className="flex items-center gap-3">
          <h1 className="font-caveat text-4xl font-bold">{group.name}</h1>
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-cream text-[10px] font-bold text-cream-light"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                {m.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
            {group.members.length > 4 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-cream bg-brand-200 text-[10px] font-bold text-brand-500">
                +{group.members.length - 4}
              </div>
            )}
          </div>
        </div>

        {/* Organic underline */}
        <svg className="mt-1 h-2 w-24" viewBox="0 0 100 8" fill="none">
          <path d="M 2 5 C 20 2, 45 7, 60 4 S 85 6, 98 3" stroke="#C4956A" strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
        </svg>

        {/* Subtitle + invite code */}
        <div className="mt-3 flex items-center gap-3">
          <p className="font-serif text-sm italic text-brand-400">
            {group.members.length} member{group.members.length !== 1 && "s"}
          </p>
          <span className="text-brand-200">·</span>
          <button
            onClick={handleShareLink}
            className="flex items-center gap-1 text-xs text-brand-300 transition-all hover:text-brand-500"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {group.inviteCode}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && isCreator && (
        <div
          className="mb-4 overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <p className="text-xs font-bold uppercase tracking-[2px] text-red-400">Danger Zone</p>
          <p className="mt-2 text-sm text-red-600">
            This will permanently delete the group and all its data.
          </p>
          <button
            onClick={handleDeleteGroup}
            disabled={deleteGroup.isPending}
            className="mt-3 rounded-full bg-red-100 px-5 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-200 active:scale-[0.97] disabled:opacity-40"
          >
            {deleteGroup.isPending ? "Deleting..." : "Delete Group"}
          </button>
        </div>
      )}

      {/* Start Split CTA */}
      {!showSplitPicker && group.members.length > 1 && (
        <button
          onClick={() => {
            setSelectedIds(new Set(group.members.map(m => m.id)));
            setShowSplitPicker(true);
          }}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 py-4 font-caveat text-xl font-medium text-cream-light shadow-md transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Start a Split
        </button>
      )}

      {/* Member Picker for Split */}
      {showSplitPicker && (
        <div
          className="mb-6 rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-caveat text-lg font-semibold">Who&apos;s splitting?</h3>
            <button onClick={toggleAll} className="text-sm text-brand-400 hover:text-brand-600">
              {selectedIds.size === group.members.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          <p className="mb-3 font-serif text-xs italic text-brand-300">
            Selected members will be invited to join the split.
          </p>

          <ul className="mb-4 space-y-1">
            {group.members.map((member, i) => (
              <li key={member.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-cream">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="h-4 w-4 rounded border-brand-300 accent-brand-700"
                  />
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-cream-light"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  >
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
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
      <section
        className="mb-8"
      >
        <div className="mb-3 flex items-center gap-2">
          <svg className="h-4 w-4 text-brand-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21V19C16 16.79 13.76 15 11 15H5C2.24 15 0 16.79 0 19V21" />
            <circle cx="8" cy="7" r="4" />
            <path d="M20 8V14M23 11H17" />
          </svg>
          <h2 className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Members</h2>
        </div>

        {group.members.length === 0 ? (
          <p className="font-serif text-sm italic text-brand-300">
            No members yet. Share the invite link above.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {group.members.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-cream-light px-4 py-3 shadow-sm"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-cream-light"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-700">{member.displayName}</p>
                  {member.userId === session?.user.id && (
                    <p className="text-[10px] text-brand-300">you</p>
                  )}
                </div>
                {isCreator && member.userId !== session?.user.id && (
                  <button
                    onClick={() => handleDeleteMember(member.id, member.displayName)}
                    className="rounded-full px-3 py-1 text-xs text-brand-300 transition-all hover:bg-red-50 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer tagline */}
      <div className="flex justify-center pb-4">
        <p className="font-caveat text-sm text-brand-300" style={{ opacity: 0.4 }}>
          ~ PlaDukKhlongToei ~
        </p>
      </div>
    </div>
  );
}
