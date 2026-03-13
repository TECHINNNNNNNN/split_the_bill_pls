"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { roomQueries } from "@/lib/queries/rooms";
import { useTogglePaid } from "@/lib/mutations/rooms";

export default function PaymentTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();

  const { data: codeData } = useQuery(roomQueries.byCode(code));
  const roomId = codeData?.room?.id ?? "";
  const currentMemberId = codeData?.currentMemberId;

  const { data: detailData } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
    refetchInterval: 3000, // poll for payment updates
  });

  const room = detailData?.room;
  const members = room?.members ?? [];
  const payments = room?.payments ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;
  const hostMember = members.find((m) => m.isHost);

  const togglePaid = useTogglePaid(roomId);

  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const paidTotal = payments
    .filter((p) => p.isPaid)
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const paidCount = payments.filter((p) => p.isPaid).length;

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
        Payment Tracking
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isHost ? "Track who has paid." : "See how much you owe."}
      </p>

      {/* PromptPay info — shown to non-host members */}
      {!isHost && room.promptpayId && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-800">Pay via PromptPay</p>
          <p className="mt-1 text-lg font-semibold text-gray-800">{room.promptpayId}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Send to {hostMember?.displayName}
          </p>
        </div>
      )}

      {/* Your amount — shown to non-host members */}
      {!isHost && currentMemberId && (() => {
        const myPayment = payments.find((p) => p.memberId === currentMemberId);
        if (!myPayment) return null;
        return (
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-800 p-4 text-white">
            <div className="flex items-center justify-between">
              <span className="font-medium">You owe</span>
              <span className="text-xl font-bold">฿{parseFloat(myPayment.amount).toFixed(2)}</span>
            </div>
            {myPayment.isPaid && (
              <p className="mt-1 text-sm text-green-300">Marked as paid</p>
            )}
          </div>
        );
      })()}

      {/* Progress bar */}
      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {paidCount}/{payments.length} paid
          </span>
          <span className="text-gray-800">
            ฿{paidTotal.toFixed(2)}/฿{total.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-800 transition-all duration-300"
            style={{
              width: `${payments.length > 0 ? (paidCount / payments.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Host card (you) — if current user is host */}
      {hostMember && (
        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-800">
              {hostMember.displayName}
              {isHost && <span className="text-gray-400"> (you)</span>}
            </span>
            <span className="text-gray-800">
              ฿{(() => {
                const hostPayment = payments.find(
                  (p) => p.memberId === hostMember.id
                );
                return hostPayment
                  ? parseFloat(hostPayment.amount).toFixed(2)
                  : "0.00";
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Member payment cards */}
      <div className="mt-2 space-y-2">
        {payments
          .filter((p) => p.memberId !== hostMember?.id)
          .map((payment) => (
            <div
              key={payment.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Clock icon for unpaid */}
                  {!payment.isPaid && (
                    <svg
                      className="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  {/* Checkmark for paid */}
                  {payment.isPaid && (
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                  <span className="font-medium text-gray-800">
                    {payment.member?.displayName}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-gray-800">
                    ฿{parseFloat(payment.amount).toFixed(2)}
                  </span>

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => togglePaid.mutate(payment.id)}
                      disabled={togglePaid.isPending}
                      className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                        payment.isPaid
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {payment.isPaid ? "Paid" : "Mark Paid"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Back to Home */}
      <div className="mt-auto flex justify-center pt-8">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 md:px-10 md:py-3 md:text-base"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
