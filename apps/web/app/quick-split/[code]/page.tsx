"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/skeleton";

const LobbyContent = dynamic(() => import("./lobby-content"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-svh flex-col items-center px-6 py-8 md:py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-[230px] w-[230px] rounded-2xl" />
        <Skeleton className="h-12 w-48 rounded-full" />
      </div>
    </div>
  ),
});

export default function RoomLobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return <LobbyContent params={params} />;
}
