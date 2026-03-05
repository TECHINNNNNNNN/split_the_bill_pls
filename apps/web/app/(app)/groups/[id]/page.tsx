"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { groupQueries } from "@/lib/queries/groups";
import { useAddGroupMember, useDeleteGroupMember } from "@/lib/mutations/groups";
import Link from "next/link";
import toast from "react-hot-toast";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: group, isLoading, error } = useQuery(groupQueries.detail(id));

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const addMember = useAddGroupMember(id);
  const deleteMember = useDeleteGroupMember(id);

  if (isLoading) {
    return <p className="text-gray-400">Loading group...</p>;
  }

  if (error || !group) {
    return (
      <div className="text-center">
        <p className="text-red-500">Group not found</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-2 text-sm text-gray-500 underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = memberName.trim();
    if (!trimmed) return;

    addMember.mutate(
      { displayName: trimmed, isGuest: true },
      {
        onSuccess: () => {
          setMemberName("");
          setShowAddMember(false);
          toast.success(`${trimmed} added!`);
        },
        onError: () => {
          toast.error("Failed to add member");
        },
      }
    );
  };

  const handleDeleteMember = (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the group?`)) return;

    deleteMember.mutate(memberId, {
      onSuccess: () => toast.success(`${name} removed`),
      onError: () => toast.error("Failed to remove member"),
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-2 text-sm text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
        <h1 className="font-heading text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-gray-500">
          {group.members.length} member{group.members.length !== 1 && "s"}
          {" · "}
          {group.bills.length} bill{group.bills.length !== 1 && "s"}
        </p>
      </div>

      {/* Members */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Members</h2>
          <button
            onClick={() => setShowAddMember(true)}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            + Add
          </button>
        </div>

        {/* Add member inline form */}
        {showAddMember && (
          <form onSubmit={handleAddMember} className="mb-3 flex gap-2">
            <input
              type="text"
              placeholder="Friend's name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              maxLength={100}
              autoFocus
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-colors focus:border-gray-400"
            />
            <button
              type="submit"
              disabled={!memberName.trim() || addMember.isPending}
              className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              {addMember.isPending ? "..." : "Add"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddMember(false);
                setMemberName("");
              }}
              className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
        )}

        {group.members.length === 0 ? (
          <p className="text-sm text-gray-400">
            No members yet. Add friends to start splitting bills.
          </p>
        ) : (
          <ul className="space-y-2">
            {group.members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium">
                    {member.displayName}
                  </span>
                  {member.isGuest && (
                    <span className="ml-2 text-xs text-gray-400">Guest</span>
                  )}
                </div>
                <button
                  onClick={() =>
                    handleDeleteMember(member.id, member.displayName)
                  }
                  className="text-xs text-gray-400 transition-colors hover:text-red-500"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bills */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Bills</h2>
          <Link
            href={`/bills/new?groupId=${id}`}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            + New Bill
          </Link>
        </div>

        {group.bills.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center">
            <p className="text-sm text-gray-400">No bills yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {group.bills.map((bill) => (
              <Link
                key={bill.id}
                href={`/bills/${bill.id}`}
                className="block rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{bill.name}</h3>
                  <span className="text-xs text-gray-400">{bill.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
