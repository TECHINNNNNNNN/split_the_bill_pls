"use client";

import type { CollabItem } from "@/lib/hooks/use-bill-collab";

export function ItemCard({
  item,
  isLocked,
  isHost,
  currentMemberId,
  members,
  onDelete,
  onToggleMember,
  onSelectAll,
}: {
  item: CollabItem;
  isLocked: boolean;
  isHost: boolean;
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  onDelete: () => void;
  onToggleMember: (memberId: string) => void;
  onSelectAll: () => void;
}) {
  const canEdit = !isLocked;
  const canDelete = canEdit && (item.addedBy === currentMemberId || isHost);

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-800">{item.name}</p>
          <p className="text-sm text-gray-500">฿{item.amount.toFixed(2)}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
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
                onChange={onSelectAll}
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
                onClick={() => onToggleMember(member.id)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-400"
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
}
