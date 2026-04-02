import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return {
    title: "PlaDuk — Bill Split Recap",
    description: "See how we split the bill — powered by PlaDuk",
    openGraph: {
      title: "PlaDuk — Bill Split Recap",
      description: "See how we split the bill — all settled!",
      siteName: "PlaDuk",
      type: "website",
    },
    other: {
      // Force fresh OG image on each share
      "og:image:alt": `Bill split recap for room ${code}`,
    },
  };
}

export default async function RecapPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let roomName = "Bill Split";
  let hostName = "Someone";
  let memberCount = 0;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${apiUrl}/api/rooms/code/${code}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const room = data.room;
      if (room) {
        roomName = room.name || `${room.hostName}'s Split`;
        hostName = room.hostName || "Someone";
        memberCount = room.members?.length || 0;
      }
    }
  } catch {
    // defaults
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        {/* Corner ornament top */}
        <svg className="mb-6 h-10 w-10 text-brand-200" viewBox="0 0 65 65" fill="none">
          <path d="M 0 32 L 0 0 L 32 0" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="3" cy="3" r="1.5" fill="currentColor" />
        </svg>

        {/* Branding */}
        <p className="font-caveat text-4xl font-bold text-brand-800">Pladuk</p>
        <p className="mt-1 font-serif text-sm italic text-brand-400">หารบิลง่ายๆ</p>

        {/* Decorative line */}
        <div className="mt-6 h-[1.5px] w-12 bg-accent" style={{ backgroundColor: "#C4956A" }} />

        {/* Room info */}
        <p className="mt-6 text-xs font-bold uppercase tracking-[5px] text-brand-400">Bill Split Recap</p>
        <h1 className="mt-2 font-caveat text-3xl font-bold text-brand-800">
          {roomName}
        </h1>
        <p className="mt-1 font-serif text-sm italic text-brand-400">
          {hostName} · {memberCount} members
        </p>

        {/* Catfish illustration */}
        <svg
          className="mt-8 h-20 w-28 animate-float"
          viewBox="0 0 340 160"
          fill="none"
          stroke="#3d2810"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.12 }}
        >
          <g transform="translate(170, 80)">
            <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
            <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
            <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
            <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
            <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
            <path d="M 25 -46 C 35 -72, 60 -68, 70 -42" strokeWidth="2.5" />
            <path d="M 50 48 C 55 58, 65 56, 64 46" strokeWidth="1.8" />
            <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
            <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
            <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
            <circle cx="-35" cy="-6" r="6.5" fill="#3d2810" stroke="none" />
          </g>
        </svg>

        <p className="mt-4 font-serif text-lg italic text-brand-300">
          All settled!
        </p>

        {/* Tagline */}
        <p className="mt-6 font-caveat text-base text-brand-300" style={{ opacity: 0.5 }}>
          split bills, not friendships
        </p>

        {/* CTA */}
        <a
          href={`/quick-split/${code}/tracking`}
          className="mt-8 rounded-full bg-brand-700 px-8 py-3 text-sm font-medium text-cream-light transition-all hover:bg-brand-800 active:scale-[0.98]"
        >
          View Details
        </a>

        <p className="mt-6 font-serif text-xs italic text-brand-300" style={{ opacity: 0.4 }}>
          pladuk.online
        </p>
      </div>
    </div>
  );
}
