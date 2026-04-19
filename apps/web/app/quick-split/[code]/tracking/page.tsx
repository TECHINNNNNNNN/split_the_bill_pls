"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/skeleton";

const TrackingContent = dynamic(() => import("./tracking-content"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  ),
});

export default function TrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return <TrackingContent params={params} />;
}
