"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { groupQueries } from "@/lib/queries/groups";
import { roomQueries } from "@/lib/queries/rooms";
import { useAcceptInvite, useDeclineInvite } from "@/lib/mutations/rooms";
import { settlementQueries } from "@/lib/queries/settlements";
import { useUserSocket } from "@/lib/hooks/use-user-socket";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import Image from "next/image";
import { Link } from "next-view-transitions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Skeleton } from "@/components/skeleton";
import { Magnetic } from "@/components/magnetic";

function roomHref(code: string, status: string) {
  switch (status) {
    case "splitting": return `/quick-split/${code}/bill`;
    case "payment":
    case "settled": return `/quick-split/${code}/tracking`;
    default: return `/quick-split/${code}`;
  }
}

const STATUS_DOT: Record<string, string> = {
  waiting: "bg-amber-400",
  splitting: "bg-blue-400",
  payment: "bg-orange-400",
  settled: "bg-green-400",
};

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();

  useUserSocket(session?.user.id);
  const { data: groups, isLoading: groupsLoading } = useQuery(groupQueries.all());
  const { data: myRooms, isLoading: roomsLoading } = useQuery(roomQueries.my());
  const { data: invites, isLoading: invitesLoading } = useQuery(roomQueries.invites());
  const { data: balancesData, isLoading: balancesLoading } = useQuery(settlementQueries.balances());
  const { data: pendingSettlements, isLoading: pendingLoading } = useQuery(settlementQueries.pending());
  const { data: insightsData, isLoading: insightsLoading } = useQuery(settlementQueries.insights());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

  // Wait for ALL data before rendering — clean waterfall, no flicker
  const allLoaded = !groupsLoading && !roomsLoading && !invitesLoading && !balancesLoading && !pendingLoading && !insightsLoading;

  const balances = balancesData?.balances ?? [];
  const pending = pendingSettlements?.pending ?? [];

  // Waterfall delays — only applied after all data is ready
  const ctaDelay = "100ms";
  const insightsDelay = "200ms";
  const invitesDelay = "300ms";
  const balancesDelay = "400ms";
  const recentDelay = "500ms";
  const groupsDelay = "600ms";

  if (!allLoaded) {
    return (
      <div className="px-4 py-6 md:mx-auto md:max-w-lg md:py-12">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* CTA skeleton */}
        <Skeleton className="mb-6 h-20 rounded-2xl" />
        {/* Insights skeleton */}
        <Skeleton className="mb-6 h-20 rounded-2xl" />
        {/* Recent skeleton */}
        <Skeleton className="mb-3 h-5 w-16" />
        <div className="mb-8 flex gap-3">
          <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
          <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
          <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
        </div>
        {/* Groups skeleton */}
        <Skeleton className="mb-3 h-5 w-20" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="mt-2 h-14 rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="animate-section mb-8 flex items-center justify-between">
        <div>
          <p className="font-heading text-sm text-brand-400">Welcome back,</p>
          <h1 className="font-heading text-3xl font-bold">
            {session?.user.name?.split(" ")[0]}
          </h1>
        </div>
        <Link href="/settings" className="group relative">
          {session?.user.image ? (
            <Image
              src={session.user.image}
              alt="avatar"
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="rounded-full border-2 border-brand-200 transition-shadow group-hover:shadow-md"
              unoptimized
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 font-heading text-base font-bold text-brand-600 transition-shadow group-hover:shadow-md">
              {session?.user.name?.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Settings gear badge */}
          <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-cream bg-brand-700 transition-transform group-hover:scale-110">
            <svg className="h-2.5 w-2.5 text-cream-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </div>
        </Link>
      </div>

      {/* ─── Quick Split CTA ─── */}
      <Magnetic strength={0.1} className="animate-section mb-8 -mx-2 px-2 -my-2 py-2" style={{ animationDelay: ctaDelay }}>
      <Link
        href="/quick-split"
        className="gradient-border group relative flex items-center justify-between rounded-2xl bg-brand-700 p-5 shadow-md transition-all hover:bg-brand-800 active:scale-[0.99]"
      >
        {/* Clip container for watermark */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <svg
          className="absolute -right-4 -bottom-3 h-28 w-28 text-cream-light/6 transition-transform duration-500 group-hover:scale-110 group-hover:text-cream-light/10"
          viewBox="0 0 100 100"
          fill="currentColor"
        >
          {/* Catfish body */}
          <ellipse cx="45" cy="50" rx="30" ry="18" />
          {/* Tail */}
          <path d="M72 42 C85 30, 92 38, 88 50 C92 62, 85 70, 72 58 Z" />
          {/* Top fin */}
          <path d="M30 33 C35 22, 45 24, 48 32 Z" />
          {/* Bottom fin */}
          <path d="M40 67 C45 75, 52 73, 50 66 Z" />
          {/* Whiskers */}
          <path d="M18 45 C8 40, 5 42, 2 38" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M18 48 C8 48, 4 50, 1 48" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M18 55 C10 58, 6 56, 3 58" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* Eye */}
          <circle cx="26" cy="46" r="3" fill="none" />
        </svg>
        </div>

        <div className="relative z-10">
          <p className="font-heading text-2xl font-semibold text-cream-light">Quick Split</p>
          <p className="mt-0.5 font-heading text-sm text-brand-200">Tap to start splitting →</p>
        </div>

        {/* Catfish icon button */}
        <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-cream-light/20 transition-all group-hover:bg-cream-light/30">
          <svg
            className="h-7 w-7 text-cream-light"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Catfish body */}
            <ellipse cx="11" cy="12" rx="7" ry="4.5" />
            {/* Tail fin */}
            <path d="M17 9.5C20 7, 22 9, 21 12C22 15, 20 17, 17 14.5" />
            {/* Top fin */}
            <path d="M8 7.5C9 5, 12 5.5, 12.5 7.5" />
            {/* Whiskers */}
            <path d="M4.5 10.5C2.5 9.5, 1.5 10, 1 9" />
            <path d="M4.5 12C2 12, 1 12.5, 0.5 12" />
            <path d="M4.5 13.5C2.5 14.5, 1.5 14, 1 15" />
            {/* Eye */}
            <circle cx="7.5" cy="11" r="0.8" fill="currentColor" stroke="none" />
          </svg>
        </div>
      </Link>
      </Magnetic>

      {/* ─── Insights summary card ─── */}
      {insightsData && insightsData.splitCount > 0 && (
        <Link
          href="/insights"
          className="animate-section mb-6 block rounded-2xl border border-brand-200 bg-cream-light p-5 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
          style={{ animationDelay: insightsDelay }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[3px] text-brand-300">Your Spending</p>
              <p className="mt-1 font-heading text-2xl font-bold text-brand-800">
                ฿{insightsData.totalSpent.toFixed(2)}
              </p>
              <p className="mt-0.5 text-xs text-brand-300">
                across {insightsData.roomCount} splits
                {insightsData.topFriends?.[0] && ` · mostly with ${insightsData.topFriends[0].name}`}
              </p>
            </div>
            <span className="font-heading text-xs text-brand-400">See insights →</span>
          </div>
        </Link>
      )}

      {/* ─── Pending invites (urgent, top) ─── */}
      {!invitesLoading && invites && invites.length > 0 && (
        <div className="animate-section mb-6 space-y-2" style={{ animationDelay: invitesDelay }}>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm"
            >
              <div>
                <p className="text-sm font-medium">
                  {invite.room.name || `${invite.room.hostName}'s split`}
                </p>
                <p className="text-xs text-brand-300">
                  Invited as {invite.displayName}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    acceptInvite.mutate(invite.id, {
                      onSuccess: (data) => {
                        toast.success("Joined!");
                        router.push(`/quick-split/${data.inviteCode}`);
                      },
                      onError: () => toast.error("Failed to accept"),
                    });
                  }}
                  disabled={acceptInvite.isPending}
                  className="rounded-xl bg-brand-700 px-3 py-1.5 text-xs font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97] disabled:opacity-40"
                >
                  Join
                </button>
                <button
                  onClick={() => {
                    declineInvite.mutate(invite.id, {
                      onSuccess: () => toast.success("Declined"),
                      onError: () => toast.error("Failed to decline"),
                    });
                  }}
                  disabled={declineInvite.isPending}
                  className="rounded-xl border border-brand-200 px-3 py-1.5 text-xs text-brand-400 transition-all hover:bg-cream active:scale-[0.97] disabled:opacity-40"
                >
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Balances + Pending settlements (compact card) ─── */}
      {(balances.length > 0 || pending.length > 0) && (
        <section className="animate-section mb-8" style={{ animationDelay: balancesDelay }}>
          <h2 className="font-heading text-xl font-semibold mb-3">Balances</h2>
          <div className="rounded-2xl border border-brand-200 bg-cream-light shadow-sm overflow-hidden">
            {/* Pending settlements first */}
            {pending.map((s) => {
              const payerName = (s as { payer?: { name?: string } }).payer?.name ?? "Someone";
              return (
                <Link
                  key={s.id}
                  href={`/settle/detail/${s.id}`}
                  className="flex items-center justify-between border-b border-brand-100 px-4 py-3 transition-colors hover:bg-cream last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-sm">{payerName} claims paid</span>
                  </div>
                  <span className="font-heading text-base font-semibold text-warning">
                    ฿{parseFloat(s.netAmount).toFixed(2)}
                  </span>
                </Link>
              );
            })}

            {/* Balance rows */}
            {balances.map((balance) => {
              const isPositive = balance.netAmount > 0;
              return (
                <div
                  key={balance.otherUserId}
                  className="flex items-center justify-between border-b border-brand-100 px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isPositive ? "bg-red-400" : "bg-green-400"}`} />
                    <span className="text-sm">{balance.otherUserName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium ${isPositive ? "text-error" : "text-success"}`}>
                      {isPositive ? `-฿${balance.netAmount.toFixed(2)}` : `+฿${Math.abs(balance.netAmount).toFixed(2)}`}
                    </span>
                    {isPositive && (
                      <Link
                        href={`/settle/${balance.otherUserId}`}
                        className="rounded-full bg-brand-700 px-3 py-1 text-xs font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97]"
                      >
                        Pay
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Recent splits (horizontal scroll) ─── */}
      <section className="animate-section mb-8" style={{ animationDelay: recentDelay }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">Recent</h2>
          <Link href="/rooms" className="text-xs font-medium text-brand-400 hover:text-brand-600">
            See all →
          </Link>
        </div>
        {roomsLoading ? (
          <div className="flex gap-3">
            <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
            <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
            <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
          </div>
        ) : !myRooms?.length ? (
          <p className="font-heading text-sm text-brand-300">No splits yet. Start one above!</p>
        ) : (
          <div className="scrollbar-hidden -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {myRooms.slice(0, 8).map((room) => (
              <Link
                key={room.id}
                href={roomHref(room.inviteCode, room.status)}
                className="flex w-36 shrink-0 flex-col justify-between rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
              >
                <div>
                  <p className="text-sm font-medium leading-tight line-clamp-2">
                    {room.name || `${room.hostName}'s split`}
                  </p>
                  <p className="mt-1 text-xs text-brand-300">
                    {room.members.length} member{room.members.length !== 1 && "s"}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[room.status] ?? "bg-brand-300"}`} />
                  <span className="text-[10px] text-brand-400">
                    {room.status === "waiting" ? "Waiting" : room.status === "splitting" ? "Splitting" : room.status === "payment" ? "Payment" : "Done"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ─── Groups (compact) ─── */}
      <section className="animate-section" style={{ animationDelay: groupsDelay }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">
            Groups {groups?.length ? <span className="text-brand-300">({groups.length})</span> : null}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoinGroup(!showJoinGroup)}
              className="rounded-xl border border-brand-200 px-3 py-1.5 text-sm text-brand-500 transition-all hover:bg-cream-light active:scale-[0.97]"
            >
              Join
            </button>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="rounded-xl bg-brand-700 px-3 py-1.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97]"
            >
              + New
            </button>
          </div>
        </div>

        {showJoinGroup && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = groupCode.trim();
              if (!trimmed) return;
              router.push(`/groups/join/${trimmed}`);
            }}
            className="mb-3 flex gap-2"
          >
            <input
              type="text"
              placeholder="Enter group code"
              value={groupCode}
              onChange={(e) => setGroupCode(e.target.value)}
              autoFocus
              className="flex-1 rounded-xl border border-brand-200 bg-cream-light px-4 py-2.5 text-sm placeholder:text-brand-300 focus:border-brand-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!groupCode.trim()}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97] disabled:opacity-40"
            >
              Go
            </button>
            <button
              type="button"
              onClick={() => { setShowJoinGroup(false); setGroupCode(""); }}
              className="rounded-xl border border-brand-200 px-3 py-2.5 text-sm text-brand-400 transition-all hover:bg-cream-light active:scale-[0.97]"
            >
              Cancel
            </button>
          </form>
        )}

        {groupsLoading ? (
          <Skeleton className="h-14 rounded-2xl" />
        ) : !groups?.length ? (
          <button
            onClick={() => setShowCreateGroup(true)}
            className="w-full rounded-2xl border-2 border-dashed border-brand-200 py-6 text-center transition-all hover:bg-cream-light active:scale-[0.99]"
          >
            <p className="font-heading text-base text-brand-300">Create your first group</p>
          </button>
        ) : (
          <div className="rounded-2xl border border-brand-200 bg-cream-light shadow-sm overflow-hidden">
            {groups.map((group, i) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-cream ${i < groups.length - 1 ? "border-b border-brand-100" : ""}`}
              >
                <span className="text-sm font-medium">{group.name}</span>
                <span className="text-xs text-brand-300">
                  {group.members.length} member{group.members.length !== 1 && "s"} →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
      />
    </div>
  );
}
