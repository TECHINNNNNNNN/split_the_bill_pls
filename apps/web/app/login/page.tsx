"use client";

import { Link } from "next-view-transitions";
import { signIn, useSession } from "@/lib/auth-client";
import { toast } from "sonner";
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

  const handleSocialSignIn = (provider: string) => {
    setLoading(true);
    signIn.social({
      provider: provider as "google",
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
        className="mt-10 flex flex-col items-center gap-5"
      >
        <Link
          href="/quick-split"
          className="rounded-full bg-brand-700 px-10 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98] md:text-base"
        >
          Quick Split
        </Link>

        <div className="flex flex-col items-center gap-2.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-brand-300">or sign in with</span>
          <div className="flex items-center gap-3">
            {/* Google */}
            <button
              onClick={() => handleSocialSignIn("google")}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-200 bg-cream-light transition-all hover:border-brand-400 hover:shadow-sm active:scale-95 disabled:opacity-40"
              title="Google"
            >
              <GoogleIcon />
            </button>
            {/* GitHub */}
            <button
              onClick={() => handleSocialSignIn("github")}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#24292f] text-white transition-all hover:bg-[#1b1f23] hover:shadow-sm active:scale-95 disabled:opacity-40"
              title="GitHub"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
            </button>
            {/* Discord */}
            <button
              onClick={() => handleSocialSignIn("discord")}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5865F2] text-white transition-all hover:bg-[#4752C4] hover:shadow-sm active:scale-95 disabled:opacity-40"
              title="Discord"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" /></svg>
            </button>
            {/* LINE */}
            <button
              onClick={() => handleSocialSignIn("line")}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#06C755] text-white transition-all hover:bg-[#05b04c] hover:shadow-sm active:scale-95 disabled:opacity-40"
              title="LINE"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596a.638.638 0 01-.199.031c-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595a.64.64 0 01.194-.033c.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" /></svg>
            </button>
            {/* Spotify */}
            <button
              onClick={() => handleSocialSignIn("spotify")}
              disabled={loading}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1DB954] text-white transition-all hover:bg-[#1aa34a] hover:shadow-sm active:scale-95 disabled:opacity-40"
              title="Spotify"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>
            </button>
          </div>
        </div>

        {/* TikTok — Easter egg 🥚 */}
        <button
          onClick={() => {
            toast("ตต ยังไม่มานะค้าาบอ้วววง 555", {
              description: "TikTok กำลังพิจารณาอยู่นะ รอแป๊บ 🙏🏻",
            });
          }}
          className="flex items-center gap-2 rounded-full bg-black px-5 py-2 text-xs font-medium text-white transition-all hover:bg-gray-800 active:scale-[0.97]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.49a8.24 8.24 0 004.85 1.56V7.64a4.83 4.83 0 01-1.09-.95z" /></svg>
          log in with your For You Page
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
