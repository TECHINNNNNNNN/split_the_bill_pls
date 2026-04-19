"use client";

import { use, useEffect, useState } from "react";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { getRoomRedirect } from "@/lib/utils/room-redirect";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { roomQueries } from "@/lib/queries/rooms";
import { useSetPaymentMethod, useUnfinalizeRoom } from "@/lib/mutations/rooms";
import { Skeleton } from "@/components/skeleton";
import { SyncIndicator } from "@/components/sync-indicator";

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

  const { data: detailData, isFetching: isDetailFetching } = useQuery({
    ...roomQueries.detail(roomId),
    enabled: !!roomId,
  });

  const room = detailData?.room;
  const payments = room?.payments ?? [];

  const setPaymentMethod = useSetPaymentMethod(roomId);
  const unfinalizeRoom = useUnfinalizeRoom(roomId);

  const { data: session } = useSession();
  const userPromptpayId = (session?.user as { promptpayId?: string | null })?.promptpayId ?? "";

  const [activeTab, setActiveTab] = useState<PaymentTab>("promptpay");
  const [promptpayId, setPromptpayId] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const pathname = usePathname();
  const currentMemberId = codeData?.currentMemberId ?? "";
  const members = room?.members ?? [];
  const isHost = members.find((m) => m.id === currentMemberId)?.isHost ?? false;

  const [isNavigating, setIsNavigating] = useState(false);

  // Status guard: redirect if room is not in the right phase
  // Skip while navigating — prevents flash of wrong UI during transition
  useEffect(() => {
    if (!room || isNavigating || isDetailFetching) return;
    const redirect = getRoomRedirect(code, room.status, isHost, pathname);
    if (redirect) router.replace(redirect);
  }, [room, code, isHost, pathname, router, isNavigating, isDetailFetching]);

  const displayPromptpayId = promptpayId || userPromptpayId;

  const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

  // Can the host go back to editing? Only if no non-host member has claimed/confirmed.
  const hostMemberId = members.find((m) => m.isHost)?.id;
  const canUnfinalize = !payments.some(
    (p) => p.memberId !== hostMemberId && (p.status === "claimed" || p.status === "confirmed"),
  );

  const handleContinue = () => {
    if (activeTab === "promptpay") {
      if (!displayPromptpayId.trim()) return;
      setPaymentMethod.mutate(
        { paymentMethod: "promptpay", promptpayId: displayPromptpayId.trim(), promptpayType: "phone" },
        {
          onSuccess: () => router.replace(`/quick-split/${code}/tracking`),
          onError: () => toast.error("Couldn't save PromptPay — check your number 🔢"),
        }
      );
    } else if (activeTab === "bank") {
      if (!bankAccountNumber.trim()) return;
      setPaymentMethod.mutate(
        { paymentMethod: "bank", bankName, bankAccountNumber: bankAccountNumber.trim() },
        {
          onSuccess: () => router.replace(`/quick-split/${code}/tracking`),
          onError: () => toast.error("Couldn't save bank details — try again"),
        }
      );
    } else {
      setPaymentMethod.mutate(
        { paymentMethod: "other", paymentNote: paymentNote.trim() || "Settle up in person" },
        {
          onSuccess: () => router.replace(`/quick-split/${code}/tracking`),
          onError: () => toast.error("Something went wrong — try again 😬"),
        }
      );
    }
  };

  if (!room) {
    return (
      <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-3 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
        <Skeleton className="mt-6 h-32 rounded-2xl" />
        <Skeleton className="mt-6 h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col px-6 py-6 md:mx-auto md:max-w-lg md:py-12">
      {/* Header */}
      {canUnfinalize ? (
        <button
          type="button"
          disabled={unfinalizeRoom.isPending}
          onClick={() => {
            unfinalizeRoom.mutate(undefined, {
              onSuccess: () => {
                setIsNavigating(true);
                router.replace(`/quick-split/${code}/bill`);
              },
              onError: () => toast.error("Couldn't go back — try again"),
            });
          }}
          className="flex items-center gap-1 self-start text-sm text-brand-400 hover:text-brand-700 disabled:opacity-40"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        {unfinalizeRoom.isPending ? "Going back..." : "Back to editing"}
      </button>
      ) : (
        <button
          type="button"
          onClick={() => router.replace(`/quick-split/${code}/tracking`)}
          className="flex items-center gap-1 self-start text-sm text-brand-400 hover:text-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Go to tracking
        </button>
      )}
      <div className="mt-2 flex items-center gap-2">
        <h1 className="font-caveat text-3xl font-bold md:text-4xl">
          Payment Method
        </h1>
        <SyncIndicator />
      </div>
      <p className="mt-1 font-serif text-sm italic text-brand-400">
        How should people pay you?
      </p>

      {/* Tabs */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {(["promptpay", "bank", "other"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-all active:scale-[0.97] ${
              activeTab === tab
                ? "border-brand-700 bg-brand-700 text-cream-light"
                : "border-brand-200 text-brand-500 hover:bg-cream-light"
            }`}
          >
            {tab === "promptpay" ? "PromptPay" : tab === "bank" ? "Bank" : "Other"}
          </button>
        ))}
      </div>

      {/* PromptPay form */}
      {activeTab === "promptpay" && (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-cream-light p-4">
          <p className="font-caveat text-lg font-medium">PromptPay Number</p>
          <input
            type="tel"
            value={displayPromptpayId}
            onChange={(e) => setPromptpayId(e.target.value)}
            placeholder="e.g. 09x-xxx-xxxx"
            className="mt-2 w-full rounded-xl border border-brand-200 bg-cream px-4 py-3 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
          />
        </div>
      )}

      {activeTab === "bank" && (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-cream-light p-4">
          <p className="font-caveat text-lg font-medium">Bank</p>
          <select
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-brand-200 bg-cream px-4 py-3 text-sm text-brand-600 focus:border-brand-400 focus:outline-none"
          >
            <option value="">Select your bank</option>
            <option value="กสิกรไทย (KBank)">กสิกรไทย (KBank)</option>
            <option value="ไทยพาณิชย์ (SCB)">ไทยพาณิชย์ (SCB)</option>
            <option value="กรุงเทพ (BBL)">กรุงเทพ (BBL)</option>
            <option value="กรุงไทย (KTB)">กรุงไทย (KTB)</option>
            <option value="ทหารไทยธนชาต (TTB)">ทหารไทยธนชาต (TTB)</option>
            <option value="กรุงศรี (BAY)">กรุงศรี (BAY)</option>
            <option value="ออมสิน (GSB)">ออมสิน (GSB)</option>
            <option value="เกียรตินาคินภัทร (KKP)">เกียรตินาคินภัทร (KKP)</option>
            <option value="ซีไอเอ็มบี (CIMB)">ซีไอเอ็มบี (CIMB)</option>
            <option value="อื่นๆ">อื่นๆ (Other)</option>
          </select>
          <p className="font-caveat text-lg font-medium mt-4">Account Number</p>
          <input
            type="text"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            placeholder="e.g. 123-4-56789-0"
            className="mt-2 w-full rounded-xl border border-brand-200 bg-cream px-4 py-3 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
          />
          <p className="mt-2 text-xs text-brand-300">
            Members will see your bank and account number
          </p>
        </div>
      )}

      {activeTab === "other" && (
        <div className="mt-6 rounded-2xl border border-brand-200 bg-cream-light p-4">
          <p className="font-caveat text-lg font-medium">Payment Instructions</p>
          <textarea
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            placeholder="e.g. Pay me cash at lunch, Venmo @boom123..."
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-brand-200 bg-cream px-4 py-3 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
          />
          <p className="mt-2 text-xs text-brand-300">
            Tell your friends how to pay you
          </p>
        </div>
      )}

      {/* Bill Summary */}
      <div className="mt-6 rounded-2xl border border-brand-200 bg-cream-light p-4">
        <p className="font-caveat text-lg font-medium">Bill Summary</p>
        <div className="mt-2 space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span className="text-brand-500">{p.member?.displayName}</span>
              <span className="tabular-nums">฿{parseFloat(p.amount).toFixed(2)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-brand-100 pt-2 font-medium">
            <span>Total</span>
            <span className="tabular-nums">฿{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Continue buttons */}
      <div className="mt-auto flex flex-col items-center gap-3 pt-8">
        <button
          type="button"
          onClick={handleContinue}
          disabled={
            (activeTab === "promptpay" && !displayPromptpayId.trim()) ||
            (activeTab === "bank" && (!bankName || !bankAccountNumber.trim())) ||
            setPaymentMethod.isPending
          }
          className="rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] disabled:opacity-40 md:text-base"
        >
          {setPaymentMethod.isPending ? "Saving..." : "Continue"}
        </button>
        {room?.promptpayId && (
          <button
            type="button"
            onClick={() => router.replace(`/quick-split/${code}/tracking`)}
            className="text-sm text-brand-400 hover:text-brand-600"
          >
            Skip — go to tracking
          </button>
        )}
      </div>
    </div>
  );
}
