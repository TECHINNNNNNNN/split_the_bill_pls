"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { groupQueries } from "@/lib/queries/groups";
import { useJoinGroup } from "@/lib/mutations/groups";
import { toast } from "sonner";

export default function JoinGroupPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: preview, isLoading, error } = useQuery(groupQueries.preview(code));
  const joinGroup = useJoinGroup();

  if (isLoading) {
    return <p className="text-gray-400">Loading...</p>;
  }

  if (error || !preview) {
    return (
      <div className="text-center">
        <p className="text-red-500">Group not found</p>
        <p className="mt-1 text-sm text-gray-400">
          The invite code may be invalid or expired.
        </p>
        <button
          onClick={() => router.push("/home")}
          className="mt-4 text-sm text-gray-500 underline"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (preview.alreadyMember) {
    return (
      <div className="text-center">
        <h1 className="font-heading mb-2 text-xl font-bold">{preview.name}</h1>
        <p className="mb-4 text-sm text-gray-500">
          You&apos;re already a member of this group.
        </p>
        <button
          onClick={() => router.push(`/groups/${preview.id}`)}
          className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
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
    <div className="text-center">
      <p className="mb-2 text-sm text-gray-400">You&apos;ve been invited to join</p>
      <h1 className="font-heading mb-1 text-2xl font-bold">{preview.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        {preview.memberCount} member{preview.memberCount !== 1 && "s"}
      </p>

      <button
        onClick={handleJoin}
        disabled={joinGroup.isPending}
        className="w-full rounded-xl bg-gray-900 py-3 font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
      >
        {joinGroup.isPending ? "Joining..." : "Join Group"}
      </button>

      <button
        onClick={() => router.push("/home")}
        className="mt-3 text-sm text-gray-400 hover:text-gray-600"
      >
        Cancel
      </button>
    </div>
  );
}
