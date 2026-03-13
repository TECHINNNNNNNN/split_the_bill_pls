"use client";

import Link from "next/link";
import { signIn, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      router.replace("/quick-split");
    }
  }, [isPending, session, router]);

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/quick-split`,
    });
  };

  if (isPending || session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-heading text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Pladuk
        </h1>
        <p className="text-base text-gray-500 md:text-lg">
          Split bills, not friendship.
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <Link
          href="/quick-split"
          className="rounded-full border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 active:bg-gray-100 md:px-10 md:py-3 md:text-base"
        >
          Quick Split
        </Link>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-800 md:text-base"
        >
          <GoogleIcon />
          {loading ? "Redirecting..." : "log in"}
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
