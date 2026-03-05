"use client";

import { useState, useRef, useCallback } from "react";
import { useCreateGroup } from "@/lib/mutations/groups";
import toast from "react-hot-toast";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupDialog({ open, onClose }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createGroup = useCreateGroup();

  // Reset and focus when the panel mounts — no useEffect needed
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setName("");
      inputRef.current?.focus();
    }
  }, []);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    createGroup.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          toast.success("Group created!");
          onClose();
        },
        onError: () => {
          toast.error("Failed to create group");
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div ref={panelRef} className="relative w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <h2 className="font-heading text-lg font-semibold">New Group</h2>
        <p className="mt-1 text-sm text-gray-500">
          Create a group to start splitting bills with friends.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-400"
          />

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createGroup.isPending}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
            >
              {createGroup.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
