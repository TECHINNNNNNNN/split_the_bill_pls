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
  const { data: balancesData } = useQuery(settlementQueries.balances());
  const { data: pendingSettlements } = useQuery(settlementQueries.pending());
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite();

  const balances = balancesData?.balances ?? [];
  const pending = pendingSettlements?.pending ?? [];

  return (
    <div>
      {/* ─── Header ─── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="font-serif text-sm italic text-brand-400">Welcome back,</p>
          <h1 className="font-caveat text-3xl font-bold">
            {session?.user.name?.split(" ")[0]}
          </h1>
        </div>
        <Link href="/settings">
          {session?.user.image ? (
            <Image
              src={session.user.image}
              alt="avatar"
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="rounded-full border-2 border-brand-200 transition-shadow hover:shadow-md"
              unoptimized
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-200 bg-brand-50 font-caveat text-base font-bold text-brand-600">
              {session?.user.name?.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
      </div>

      {/* ─── Quick Split CTA ─── */}
      <Link
        href="/quick-split"
        className="mb-8 flex items-center justify-between rounded-2xl bg-brand-700 p-5 shadow-md transition-all hover:bg-brand-800 active:scale-[0.99]"
      >
        <div>
          <p className="font-caveat text-xl font-semibold text-cream-light">Quick Split</p>
          <p className="mt-0.5 text-sm text-brand-200">No account needed for friends</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-light/20 text-xl text-cream-light">
          +
        </div>
      </Link>

      {/* ─── Pending invites (urgent, top) ─── */}
      {!invitesLoading && invites && invites.length > 0 && (
        <div className="mb-6 space-y-2">
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
        <section className="mb-8">
          <h2 className="font-caveat text-xl font-semibold mb-3">Balances</h2>
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
                  <span className="font-caveat text-base font-semibold text-warning">
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
      <section className="mb-8">
        <h2 className="font-caveat text-xl font-semibold mb-3">Recent</h2>
        {roomsLoading ? (
          <div className="flex gap-3">
            <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
            <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
            <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
          </div>
        ) : !myRooms?.length ? (
          <p className="font-serif text-sm italic text-brand-300">No splits yet. Start one above!</p>
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
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-caveat text-xl font-semibold">
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
            <p className="font-caveat text-base text-brand-300">Create your first group</p>
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
