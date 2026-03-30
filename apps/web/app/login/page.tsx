"use client";

import Link from "next/link";
import { signIn, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HandwritingTitle } from "@/components/handwriting-title";

export default function LoginPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [animDone, setAnimDone] = useState(false);

  useEffect(() => {
    if (!isPending && session) {
      router.replace("/home");
    }
  }, [isPending, session, router]);

  const handleGoogleSignIn = () => {
    setLoading(true);
    signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/home`,
    });
  };

  if (isPending || session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-brand-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6">
      {/* Corner ornaments */}
      <svg
        className="fixed left-6 top-6 h-16 w-16 transition-opacity duration-1000"
        style={{ opacity: animDone ? 1 : 0 }}
        viewBox="0 0 65 65"
        fill="none"
      >
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </svg>
      <svg
        className="fixed bottom-6 right-6 h-16 w-16 rotate-180 transition-opacity duration-1000"
        style={{ opacity: animDone ? 1 : 0 }}
        viewBox="0 0 65 65"
        fill="none"
      >
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </svg>

      {/* Decorative line */}
      <div
        className="mb-8 h-[1.5px] w-14 transition-all duration-700"
        style={{
          backgroundColor: "#C4956A",
          opacity: animDone ? 1 : 0,
          transform: animDone ? "scaleX(1)" : "scaleX(0)",
        }}
      />

      {/* Handwriting animation */}
      <HandwritingTitle onComplete={() => setAnimDone(true)} />

      {/* Subtitle + tagline */}
      <p
        className="mt-5 font-serif text-sm tracking-[0.18em] italic transition-all duration-700 md:text-base"
        style={{
          color: "#C4956A",
          opacity: animDone ? 1 : 0,
          transform: animDone ? "translateY(0)" : "translateY(10px)",
        }}
      >
        split bills, not friendships
      </p>
      <p
        className="mt-2 font-caveat text-base font-medium transition-all duration-700 md:text-lg"
        style={{
          color: "#4A3C2A",
          opacity: animDone ? 1 : 0,
          transform: animDone ? "translateY(0)" : "translateY(8px)",
          transitionDelay: "0.2s",
        }}
      >
        ~ PlaDukKhlongToei ~
      </p>

      {/* Action buttons */}
      <div
        className="mt-12 flex flex-col items-center gap-4 transition-all duration-700"
        style={{
          opacity: animDone ? 1 : 0,
          transform: animDone ? "translateY(0)" : "translateY(12px)",
          transitionDelay: "0.4s",
        }}
      >
        <Link
          href="/quick-split"
          className="rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] md:text-base"
        >
          Quick Split
        </Link>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center gap-2 text-sm transition-colors hover:text-brand-800 md:text-base"
          style={{ color: "#C4956A" }}
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
