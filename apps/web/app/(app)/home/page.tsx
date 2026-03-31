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

const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting",
  splitting: "Splitting",
  payment: "Payment",
  settled: "Settled",
};

const STATUS_COLOR: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-700",
  splitting: "bg-blue-100 text-blue-700",
  payment: "bg-orange-100 text-orange-700",
  settled: "bg-green-100 text-green-700",
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

  return (
    <div>
      {/* Header — greeting + avatar */}
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

      {/* Quick Split CTA — the hero */}
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

      {/* Pending Settlements */}
      {pendingSettlements?.pending && pendingSettlements.pending.length > 0 && (
        <section className="mb-8">
          <h2 className="font-caveat text-xl font-semibold mb-3">Pending Settlements</h2>
          <div className="space-y-2">
            {pendingSettlements.pending.map((s) => {
              const payerName = (s as { payer?: { name?: string } }).payer?.name ?? "Someone";
              const payerImage = (s as { payer?: { image?: string | null } }).payer?.image;
              return (
                <Link
                  key={s.id}
                  href={`/settle/detail/${s.id}`}
                  className="flex items-center justify-between rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    {payerImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={payerImage} alt={payerName} className="h-9 w-9 rounded-full border border-brand-200 object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-caveat text-sm font-bold text-brand-600">
                        {payerName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{payerName} claims they&apos;ve paid</p>
                      <p className="text-xs text-brand-300">Tap to review and confirm</p>
                    </div>
                  </div>
                  <span className="font-caveat text-lg font-semibold text-warning">
                    ฿{parseFloat(s.netAmount).toFixed(2)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Balances */}
      {balancesData?.balances && balancesData.balances.length > 0 && (
        <section className="mb-8">
          <h2 className="font-caveat text-xl font-semibold mb-3">Your Balances</h2>
          <div className="space-y-2">
            {balancesData.balances.map((balance) => {
              const isPositive = balance.netAmount > 0;
              return (
                <div
                  key={balance.otherUserId}
                  className="flex items-center justify-between rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    {balance.otherUserImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={balance.otherUserImage}
                        alt={balance.otherUserName}
                        className="h-9 w-9 rounded-full border border-brand-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-caveat text-sm font-bold text-brand-600">
                        {balance.otherUserName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{balance.otherUserName}</p>
                      <p className="text-xs text-brand-300">
                        {balance.roomCount} room{balance.roomCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={`text-sm font-semibold ${isPositive ? "text-error" : "text-success"}`}>
                      {isPositive ? `You owe ฿${balance.netAmount.toFixed(2)}` : `Owes you ฿${Math.abs(balance.netAmount).toFixed(2)}`}
                    </p>
                    {isPositive && (
                      <Link
                        href={`/settle/${balance.otherUserId}`}
                        className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97]"
                      >
                        Settle
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pending Invites */}
      {!invitesLoading && invites && invites.length > 0 && (
        <section className="mb-8">
          <h2 className="font-caveat text-xl font-semibold mb-3">Pending Invites</h2>
          <div className="space-y-2">
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
                    You&apos;re invited as {invite.displayName}
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
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Splits */}
      <section className="mb-8">
        <h2 className="font-caveat text-xl font-semibold mb-3">Recent Splits</h2>
        {roomsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : !myRooms?.length ? (
          <p className="font-serif text-sm italic text-brand-300">No splits yet. Start one above!</p>
        ) : (
          <div className="space-y-2">
            {myRooms.map((room) => (
              <Link
                key={room.id}
                href={roomHref(room.inviteCode, room.status)}
                className="flex items-center justify-between rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
              >
                <div>
                  <p className="font-medium">{room.name || `${room.hostName}'s split`}</p>
                  <p className="text-xs text-brand-300">
                    {room.members.length} member{room.members.length !== 1 && "s"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[room.status] ?? "bg-brand-50 text-brand-500"}`}
                >
                  {STATUS_LABEL[room.status] ?? room.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Groups */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-caveat text-xl font-semibold">Your Groups</h2>
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

        {/* Join group by code */}
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
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : !groups?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-brand-200 py-8 text-center">
            <p className="font-caveat text-base text-brand-300">No groups yet</p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="mt-3 rounded-xl bg-brand-700 px-6 py-2 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.97]"
            >
              Create your first group
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="block rounded-2xl border border-brand-200 bg-cream-light p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.99]"
              >
                <h3 className="font-medium">{group.name}</h3>
                <p className="text-xs text-brand-300">
                  {group.members.length} member{group.members.length !== 1 && "s"}
                </p>
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
