"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { groupQueries } from "@/lib/queries/groups";
import { useJoinGroup } from "@/lib/mutations/groups";
import { toast } from "sonner";
import { Skeleton } from "@/components/skeleton";

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: preview, isLoading, error } = useQuery(groupQueries.preview(code));
  const joinGroup = useJoinGroup();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center pt-16">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-24" />
        <Skeleton className="mt-8 h-12 w-full max-w-xs rounded-full" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="flex flex-col items-center pt-16 text-center">
        <p className="font-caveat text-2xl text-error">Group not found</p>
        <p className="mt-2 font-serif text-sm italic text-brand-300">
          The invite code may be invalid or expired.
        </p>
        <button
          onClick={() => router.push("/home")}
          className="mt-6 rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (preview.alreadyMember) {
    return (
      <div className="flex flex-col items-center pt-16 text-center">
        <h1 className="font-caveat text-3xl font-bold">{preview.name}</h1>
        <p className="mt-2 font-serif text-sm italic text-brand-400">
          You&apos;re already a member of this group.
        </p>
        <button
          onClick={() => router.push(`/groups/${preview.id}`)}
          className="mt-6 rounded-full bg-brand-700 px-8 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          Go to Group
        </button>
      </div>
    );
  }

  const handleJoin = () => {
    joinGroup.mutate(code, {
      onSuccess: (data) => {
        toast.success("Joined the group!");
        router.push(`/groups/${data.groupId}`);
      },
      onError: () => {
        toast.error("Failed to join group");
      },
    });
  };

  return (
    <div className="flex flex-col items-center pt-16 text-center">
      <p className="font-serif text-sm italic text-brand-400">You&apos;ve been invited to join</p>
      <h1 className="mt-2 font-caveat text-3xl font-bold">{preview.name}</h1>
      <p className="mt-1 text-sm text-brand-300">
        {preview.memberCount} member{preview.memberCount !== 1 && "s"}
      </p>

      <button
        onClick={handleJoin}
        disabled={joinGroup.isPending}
        className="mt-8 w-full max-w-xs rounded-full bg-brand-700 py-3 font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40"
      >
        {joinGroup.isPending ? "Joining..." : "Join Group"}
      </button>

      <button
        onClick={() => router.push("/home")}
        className="mt-3 text-sm text-brand-400 hover:text-brand-600"
      >
        Cancel
      </button>
    </div>
  );
}
