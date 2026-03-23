"use client";

import { useState } from "react";
import { useSession, updateUser, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { data: session, refetch } = useSession();
  const router = useRouter();
  const user = session?.user;

  const [promptpayId, setPromptpayId] = useState(user?.promptpayId ?? "");
  const [promptpayType, setPromptpayType] = useState<string>(user?.promptpayType ?? "phone");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser({
        promptpayId: promptpayId.trim() || null,
        promptpayType: promptpayId.trim() ? promptpayType : null,
      });
      await refetch();
      toast.success("PromptPay updated!");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Back
        </button>
        <h1 className="font-heading text-2xl font-bold text-gray-800">Settings</h1>
      </div>

      {/* Profile info (read-only) */}
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-lg font-bold text-gray-500">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium text-gray-800">{user.name}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      </div>

      {/* PromptPay settings */}
      <div className="rounded-xl border border-gray-200 p-4">
        <h2 className="font-heading text-base font-semibold text-gray-800">PromptPay</h2>
        <p className="mt-1 text-xs text-gray-400">
          Set your PromptPay ID so friends can pay you when you settle up.
        </p>

        <div className="mt-4 space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPromptpayType("phone")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                promptpayType === "phone"
                  ? "border-gray-800 bg-gray-800 text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Phone Number
            </button>
            <button
              type="button"
              onClick={() => setPromptpayType("national_id")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                promptpayType === "national_id"
                  ? "border-gray-800 bg-gray-800 text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              National ID
            </button>
          </div>

          {/* ID input */}
          <input
            type="text"
            value={promptpayId}
            onChange={(e) => setPromptpayId(e.target.value)}
            placeholder={promptpayType === "phone" ? "08x-xxx-xxxx" : "x-xxxx-xxxxx-xx-x"}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm outline-none transition-colors focus:border-gray-400"
            maxLength={promptpayType === "phone" ? 10 : 13}
          />

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save PromptPay"}
          </button>
        </div>
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => signOut()}
        className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
      >
        Sign out
      </button>
    </div>
  );
}
