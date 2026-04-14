"use client";

import { Link } from "next-view-transitions";
import { signIn, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Skeleton } from "@/components/skeleton";

const EASE: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];
const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.1 + i * 0.1, ease: EASE },
});

export default function LoginPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6">
      {/* Corner ornaments */}
      <motion.svg
        {...stagger(0)}
        className="fixed left-6 top-6 h-16 w-16"
        viewBox="0 0 65 65"
        fill="none"
      >
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </motion.svg>
      <motion.svg
        {...stagger(0)}
        className="fixed bottom-6 right-6 h-16 w-16 rotate-180"
        viewBox="0 0 65 65"
        fill="none"
      >
        <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.2" />
        <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
      </motion.svg>

      {/* Content wrapper — decorations positioned relative to this */}
      <div className="relative flex w-full max-w-sm flex-col items-center">
        {/* Scattered decorations — inside the content boundary */}
        {/* Receipt / bill — top right */}
        <svg className="pointer-events-none absolute -right-2 top-[5%] h-14 w-10 opacity-[0.18]" viewBox="0 0 24 32" fill="none" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round">
          <path d="M 4 2 L 4 28 L 7 26 L 10 28 L 13 26 L 16 28 L 19 26 L 19 2 Z" />
          <path d="M 8 9 L 16 9" />
          <path d="M 8 13 L 14 13" />
          <path d="M 8 17 L 16 17" />
        </svg>
        {/* Baht coin — left side */}
        <svg className="pointer-events-none absolute -left-3 top-[30%] h-12 w-12 opacity-[0.16]" viewBox="0 0 28 28" fill="none" stroke="#C4956A" strokeWidth="1.2">
          <circle cx="14" cy="14" r="12" />
          <text x="14" y="19" textAnchor="middle" fill="#C4956A" stroke="none" fontSize="13" fontWeight="bold">฿</text>
        </svg>
        {/* Two people — right side, lower */}
        <svg className="pointer-events-none absolute -right-3 top-[55%] h-12 w-16 opacity-[0.14]" viewBox="0 0 36 28" fill="none" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M 4 24 C 4 18, 8 15, 12 15 S 20 18, 20 24" />
          <circle cx="24" cy="8" r="4" />
          <path d="M 16 24 C 16 18, 20 15, 24 15 S 32 18, 32 24" />
        </svg>
        {/* Fork + knife — left side, lower */}
        <svg className="pointer-events-none absolute -left-2 top-[65%] h-14 w-10 opacity-[0.14]" viewBox="0 0 24 32" fill="none" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round">
          <path d="M 8 4 L 8 14 C 8 16, 10 16, 10 14 L 10 4" />
          <path d="M 9 14 L 9 28" />
          <path d="M 16 4 C 16 10, 14 12, 14 16 L 14 28" />
        </svg>
        {/* Organic curve — top left */}
        <svg className="pointer-events-none absolute -left-1 top-[12%] h-6 w-16 opacity-[0.16]" viewBox="0 0 40 16" fill="none">
          <path d="M 4 10 C 12 4, 28 4, 36 10" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        {/* Three dots — bottom */}
        <svg className="pointer-events-none absolute left-[15%] top-[85%] h-5 w-14 opacity-[0.14]" viewBox="0 0 32 12">
          <circle cx="4" cy="6" r="2.5" fill="#C4956A" />
          <circle cx="16" cy="6" r="2" fill="#C4956A" />
          <circle cx="28" cy="6" r="2.5" fill="#C4956A" />
        </svg>

      {/* Decorative line */}
      <motion.div
        {...stagger(1)}
        className="mb-8 h-[1.5px] w-14"
        style={{ backgroundColor: "#C4956A" }}
      />

      {/* Title */}
      <motion.h1
        {...stagger(2)}
        className="font-heading text-5xl font-semibold tracking-tight md:text-6xl"
        style={{ color: "#4A3C2A" }}
      >
        PlaDuk
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        {...stagger(3)}
        className="mt-5 font-heading text-sm tracking-[0.18em] md:text-base"
        style={{ color: "#C4956A" }}
      >
        split bills, not friendships
      </motion.p>

      {/* Tagline */}
      <motion.p
        {...stagger(4)}
        className="mt-2 font-caveat text-base font-medium md:text-lg"
        style={{ color: "#4A3C2A" }}
      >
        ~ PlaDukKhlongToei ~
      </motion.p>

      {/* Organic underline under tagline */}
      <motion.svg {...stagger(4)} className="mt-3 h-[3px] w-20" viewBox="0 0 80 3" fill="none">
        <path d="M 2 1.5 C 14 0.5, 32 2.5, 48 1 S 66 2, 78 1.5" stroke="#C4956A" strokeWidth="1" strokeLinecap="round" opacity="0.35" />
      </motion.svg>

      {/* Action buttons */}
      <motion.div
        {...stagger(5)}
        className="mt-12 flex flex-col items-center gap-4"
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
      </motion.div>
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
