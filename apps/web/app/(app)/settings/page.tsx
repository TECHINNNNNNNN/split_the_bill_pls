"use client";

import { useState } from "react";
import { useSession, updateUser, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
          onClick={() => router.push("/home")}
          className="flex items-center gap-1 text-sm text-brand-400 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="mt-1 font-heading text-3xl font-bold">Settings</h1>
      </div>

      {/* Profile info */}
      <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name}
              className="h-12 w-12 rounded-full border-2 border-brand-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 font-heading text-lg font-bold text-brand-600">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-brand-400">{user.email}</p>
          </div>
        </div>
      </div>

      {/* PromptPay settings */}
      <div className="rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm">
        <h2 className="font-heading text-xl font-semibold">PromptPay</h2>
        <p className="mt-1 font-heading text-xs text-brand-300">
          Set your PromptPay ID so friends can pay you when you settle up.
        </p>

        <div className="mt-4 space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPromptpayType("phone")}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.97] ${
                promptpayType === "phone"
                  ? "border-brand-700 bg-brand-700 text-cream-light"
                  : "border-brand-200 text-brand-500 hover:bg-cream"
              }`}
            >
              Phone Number
            </button>
            <button
              type="button"
              onClick={() => setPromptpayType("national_id")}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.97] ${
                promptpayType === "national_id"
                  ? "border-brand-700 bg-brand-700 text-cream-light"
                  : "border-brand-200 text-brand-500 hover:bg-cream"
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
            className="w-full rounded-xl border border-brand-200 bg-cream px-4 py-3 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
            maxLength={promptpayType === "phone" ? 10 : 13}
          />

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save PromptPay"}
          </button>
        </div>
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={() => signOut()}
        className="w-full rounded-xl bg-red-100 px-4 py-2.5 text-sm font-medium text-red-700 transition-all hover:bg-red-200 active:scale-[0.98]"
      >
        Sign out
      </button>
    </div>
  );
}
