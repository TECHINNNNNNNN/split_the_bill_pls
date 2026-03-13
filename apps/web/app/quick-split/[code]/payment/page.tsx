"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { roomQueries } from "@/lib/queries/rooms";
import { useSetPaymentMethod, useAdvanceRoomStatus } from "@/lib/mutations/rooms";

type PaymentTab = "promptpay" | "bank" | "other";

export default function PaymentMethodPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";

  const { data: detailData } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
  });

  const room = detailData?.room;
  const payments = room?.payments ?? [];

  const setPaymentMethod = useSetPaymentMethod(roomId);
  const advanceStatus = useAdvanceRoomStatus(roomId);

  const [activeTab, setActiveTab] = useState<PaymentTab>("promptpay");
  const [promptpayId, setPromptpayId] = useState("");

  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const handleContinue = () => {
    if (activeTab === "promptpay" && promptpayId.trim()) {
      setPaymentMethod.mutate(
        {
          promptpayId: promptpayId.trim(),
          promptpayType: "phone",
        },
        {
          onSuccess: () => {
            router.push(`/quick-split/${code}/tracking`);
          },
        }
      );
    } else {
      // For bank/other, just navigate
      router.push(`/quick-split/${code}/tracking`);
    }
  };

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
      <button
        type="button"
        onClick={() => router.back()}
        className="self-start text-sm text-gray-500 hover:text-gray-800"
      >
        Back
      </button>
      <h1 className="mt-2 font-heading text-2xl font-bold text-gray-800 md:text-3xl">
        Payment Method
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        How should people pay you?
      </p>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {(["promptpay", "bank", "other"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg border px-4 py-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-gray-800 bg-gray-800 text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab === "promptpay" ? "PromptPay" : tab === "bank" ? "Bank" : "Other"}
          </button>
        ))}
      </div>

      {/* PromptPay form */}
      {activeTab === "promptpay" && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-800">PromptPay Number</p>
          <input
            type="tel"
            value={promptpayId}
            onChange={(e) => setPromptpayId(e.target.value)}
            placeholder="e.g. 09x-xxx-xxxx"
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>
      )}

      {activeTab === "bank" && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">
            Bank transfer details coming soon. For now, share your bank info with your friends directly.
          </p>
        </div>
      )}

      {activeTab === "other" && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">
            You can collect payment however you prefer — cash, transfer, etc.
          </p>
        </div>
      )}

      {/* Bill Summary */}
      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">Bill Summary</p>
        <div className="mt-2 space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className="text-gray-600">{p.member?.displayName}</span>
              <span className="text-gray-800">฿{parseFloat(p.amount).toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 font-medium">
            <span className="text-gray-800">Total</span>
            <span className="text-gray-800">฿{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Continue button */}
      <div className="mt-auto flex justify-center pt-8">
        <button
          type="button"
          onClick={handleContinue}
          disabled={
            (activeTab === "promptpay" && !promptpayId.trim()) ||
            setPaymentMethod.isPending
          }
          className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 md:px-10 md:py-3 md:text-base"
        >
          {setPaymentMethod.isPending ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
