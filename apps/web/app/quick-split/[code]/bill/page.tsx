"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { roomQueries } from "@/lib/queries/rooms";
import { useFinalizeRoom } from "@/lib/mutations/rooms";
import { useBillCollab } from "@/lib/hooks/use-bill-collab";

export default function BillDetailsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  // Fetch room by code to get the room ID + members
  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";

  // Fetch full room details (for members list)
  const { data: detailData } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
  });

  const room = detailData?.room;
  const currentMemberId = codeData?.currentMemberId ?? "";
  const members = room?.members ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;

  // ─── Collaborative editing via PartyKit WebSocket ───
  const { items, isLocked, addItem, deleteItem, toggleMember, selectAll } = useBillCollab(
    code,
    {
      currentMemberId,
      isHost,
      members,
      onStatusChanged: (status) => {
        if (status === "payment" && !isHost) {
          router.replace(`/quick-split/${code}/tracking`);
        }
      },
    },
  );

  // Finalize mutation — sends everything in one batch
  const finalizeRoom = useFinalizeRoom(roomId);

  // Add item form state
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");

  const handleAddItem = () => {
    const amount = parseFloat(itemAmount);
    if (!itemName.trim() || isNaN(amount) || amount <= 0) return;

    addItem(itemName.trim(), amount);
    setItemName("");
    setItemAmount("");
    setShowForm(false);
  };

  const handleFinalize = () => {
    // Validate: every item must have at least 1 person
    const hasEmpty = items.some((item) => item.memberIds.length === 0);
    if (hasEmpty) {
      alert("Every item must be assigned to at least one person.");
      return;
    }

    finalizeRoom.mutate(
      {
        items: items.map((item) => ({
          name: item.name,
          amount: item.amount,
          memberIds: item.memberIds,
        })),
      },
      {
        onSuccess: () => {
          router.push(`/quick-split/${code}/payment`);
        },
      }
    );
  };

  // Calculate running total
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  if (!room) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
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

      {/* Items list (collaborative — synced via WebSocket) */}
      <div className="mt-6 flex flex-1 flex-col gap-4">
        {items.length === 0 && (
          <p className="text-center text-sm text-gray-400">
            No items yet. Tap &quot;Add Item&quot; to start!
          </p>
        )}

        {items.map((item) => {
          // Can edit if not locked (or you're the host — host has already left this page)
          const canEdit = !isLocked;
          const canDelete = canEdit && (item.addedBy === currentMemberId || isHost);

          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    ฿{item.amount.toFixed(2)}
                  </p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteItem(item.id)}
                    className="text-gray-400 transition-colors hover:text-red-500"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Split amongst chips */}
              <div className="mt-2 border-t border-gray-100 pt-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs text-gray-500">Split Amongst</p>
                  {canEdit && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={item.memberIds.length === members.length}
                        onChange={() => selectAll(item.id)}
                        className="h-3.5 w-3.5 rounded border-gray-300 accent-gray-800"
                      />
                      All
                    </label>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {members.map((member) => {
                    const isSelected = item.memberIds.includes(member.id);
                    if (!canEdit) {
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
                    }
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(item.id, member.id)}
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
                {item.memberIds.length === 0 && (
                  <p className="mt-1 text-xs text-red-400">Select at least one person</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Add item form / button — hidden when locked */}
        {isLocked ? null : showForm ? (
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem();
                }}
              />
              <input
                type="number"
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
                placeholder="Amount"
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
                min="0"
                step="0.01"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddItem();
                }}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!itemName.trim() || !itemAmount}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Add Item
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

        {isHost ? (
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
        ) : (
          <p className="mt-4 text-center text-sm text-gray-400">
            {isLocked
              ? "Host is setting up payment method..."
              : "Waiting for host to finalize..."}
          </p>
        )}
      </div>
    </div>
  );
}
