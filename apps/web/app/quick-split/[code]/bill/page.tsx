"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { roomQueries } from "@/lib/queries/rooms";
import { useAddRoomItem, useDeleteRoomItem, useFinalizeRoom } from "@/lib/mutations/rooms";
import { api } from "@/lib/api-client";
import type { SetRoomItemSplits } from "@pladuk/shared/schemas";

export default function BillDetailsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  // First fetch room by code to get the room ID
  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";

  // Then fetch full room details (items, splits, members)
  const { data: detailData } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
    refetchInterval: 5000, // light polling for consistency
  });

  const room = detailData?.room;
  const currentMemberId = codeData?.currentMemberId;
  const members = room?.members ?? [];
  const items = room?.billItems ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;

  // Mutations
  const addItem = useAddRoomItem(roomId);
  const deleteItem = useDeleteRoomItem(roomId);
  const finalizeRoom = useFinalizeRoom(roomId);

  // Toggle splits for an item (call API directly since itemId varies)
  const toggleSplit = useMutation({
    mutationFn: async ({ itemId, memberIds }: { itemId: string; memberIds: string[] }) => {
      const res = await api.api.rooms[":id"].items[":itemId"].splits.$put({
        param: { id: roomId, itemId },
        json: { memberIds } as SetRoomItemSplits,
      });
      if (!res.ok) throw new Error("Failed to update splits");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });

  // Add item form state
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  const handleAddItem = () => {
    const amount = parseFloat(itemAmount);
    if (!itemName.trim() || isNaN(amount) || amount <= 0) return;

    addItem.mutate(
      { name: itemName.trim(), amount },
      {
        onSuccess: () => {
          setItemName("");
          setItemAmount("");
          setShowForm(false);
        },
      }
    );
  };

  const handleToggleMember = (itemId: string, currentSplitMemberIds: string[], memberId: string) => {
    const isSelected = currentSplitMemberIds.includes(memberId);
    const newMemberIds = isSelected
      ? currentSplitMemberIds.filter((id) => id !== memberId)
      : [...currentSplitMemberIds, memberId];

    toggleSplit.mutate({ itemId, memberIds: newMemberIds });
  };

  const handleSelectAll = (itemId: string, currentSplitMemberIds: string[]) => {
    const allSelected = currentSplitMemberIds.length === members.length;
    // If all selected → deselect all. Otherwise → select all.
    const newMemberIds = allSelected ? [] : members.map((m) => m.id);
    toggleSplit.mutate({ itemId, memberIds: newMemberIds });
  };

  const handleFinalize = () => {
    finalizeRoom.mutate(undefined, {
      onSuccess: () => {
        router.push(`/quick-split/${code}/payment`);
      },
    });
  };

  // Auto-redirect non-host when host finalizes (status → payment)
  useEffect(() => {
    if (room && room.status === "payment") {
      router.replace(`/quick-split/${code}/tracking`);
    }
  }, [room, room?.status, code, router]);

  // Calculate running total
  const total = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  // Non-host: read-only waiting view
  if (!isHost) {
    return (
      <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
        <h1 className="font-heading text-2xl font-bold text-gray-800 md:text-3xl">
          Bill Details
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          The host is entering items. You&apos;ll be redirected when it&apos;s ready.
        </p>

        {/* Read-only items list */}
        <div className="mt-6 flex flex-1 flex-col gap-4">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400">No items yet...</p>
          ) : (
            items.map((item) => {
              const splitMemberIds = item.splits?.map((s: { memberId: string }) => s.memberId) ?? [];
              return (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">฿{parseFloat(item.amount).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-2 border-t border-gray-100 pt-2">
                    <p className="mb-1.5 text-xs text-gray-500">Split Amongst</p>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((member) => {
                        const isSelected = splitMemberIds.includes(member.id);
                        return (
                          <span
                            key={member.id}
                            className={`rounded px-2 py-0.5 text-xs font-medium ${
                              isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-400"
                            }`}
                          >
                            {member.displayName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Total */}
        <div className="mt-8 border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <span className="text-lg font-medium text-gray-800">Total</span>
            <span className="text-lg font-semibold text-gray-800">฿{total.toFixed(2)}</span>
          </div>
          <p className="mt-4 text-center text-sm text-gray-400">
            Waiting for host to finalize...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Back
          </button>
          <h1 className="font-heading text-2xl font-bold text-gray-800 md:text-3xl">
            Bill Details
          </h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Auto Scan Receipt</span>
        </div>
      </div>

      {/* Items list */}
      <div className="mt-6 flex flex-1 flex-col gap-4">
        {items.map((item) => {
          const splitMemberIds = item.splits?.map((s: { memberId: string }) => s.memberId) ?? [];

          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    ฿{parseFloat(item.amount).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteItem.mutate(item.id)}
                  className="text-gray-400 transition-colors hover:text-red-500"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Split amongst chips */}
              <div className="mt-2 border-t border-gray-100 pt-2">
                <p className="mb-1.5 text-xs text-gray-500">Split Amongst</p>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((member) => {
                    const isSelected = splitMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() =>
                          handleToggleMember(item.id, splitMemberIds, member.id)
                        }
                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-gray-800 text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {member.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add item form / button */}
        {showForm ? (
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
              />
              <input
                type="number"
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
                placeholder="Amount"
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                min="0"
                step="0.01"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!itemName.trim() || !itemAmount || addItem.isPending}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {addItem.isPending ? "Adding..." : "Add Item"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setItemName("");
                  setItemAmount("");
                }}
                className="text-sm text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="self-center rounded-full border border-gray-300 px-6 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            Add Item
          </button>
        )}
      </div>

      {/* Total + Finalize */}
      <div className="mt-8 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <span className="text-lg font-medium text-gray-800">Total</span>
          <span className="text-lg font-semibold text-gray-800">
            ฿{total.toFixed(2)}
          </span>
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={items.length === 0 || finalizeRoom.isPending}
            className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 md:px-10 md:py-3 md:text-base"
          >
            {finalizeRoom.isPending ? "Calculating..." : "Finish and Set Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
