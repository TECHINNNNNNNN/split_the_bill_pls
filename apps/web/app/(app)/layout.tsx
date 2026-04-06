"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/skeleton";
import { ChatBubble } from "@/components/insights/chat-bubble";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
        {/* Header skeleton */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* CTA skeleton */}
        <Skeleton className="mb-8 h-20 rounded-2xl" />
        {/* Recent skeleton */}
        <Skeleton className="mb-3 h-6 w-20" />
        <div className="flex gap-3">
          <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
          <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
          <Skeleton className="h-28 w-36 shrink-0 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (!session) return null;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6">
      {children}
    </main>
  );
}
