"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCreateGroup } from "@/lib/mutations/groups";
import { toast } from "sonner";

interface CreateGroupDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupDialog({ open, onClose }: CreateGroupDialogProps) {
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createGroup = useCreateGroup();

  const panelRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setName("");
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    createGroup.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          toast.success("Group created!");
          handleClose();
        },
        onError: () => {
          toast.error("Failed to create group");
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="fixed inset-0 transition-opacity duration-300"
        style={{
          backgroundColor: "rgba(61, 40, 16, 0.35)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      />

      <div
        ref={panelRef}
        className="relative w-full max-w-md rounded-t-2xl border-t border-brand-200 bg-cream p-6 shadow-lg transition-all duration-300 ease-out sm:rounded-2xl sm:border"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(24px)",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-brand-200 sm:hidden" />

        <h2 className="font-caveat text-2xl font-semibold">New Group</h2>
        <p className="mt-1 font-serif text-sm italic text-brand-400">
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
            className="w-full rounded-xl border border-brand-200 bg-cream-light px-4 py-3 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
          />

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-medium text-brand-500 transition-all hover:bg-cream-light active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createGroup.isPending}
              className="flex-1 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40"
            >
              {createGroup.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
