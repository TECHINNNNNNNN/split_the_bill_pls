import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaDuk — Bill Split Recap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont() {
  const res = await fetch(
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;700&display=swap"
  );
  const css = await res.text();
  const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!fontUrl) return null;
  return (await fetch(fontUrl)).arrayBuffer();
}

async function loadCaveat() {
  const res = await fetch(
    "https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap"
  );
  const css = await res.text();
  const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!fontUrl) return null;
  return (await fetch(fontUrl)).arrayBuffer();
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [fontData, caveatData] = await Promise.all([loadFont(), loadCaveat()]);

  let roomName = "Bill Split";
  let hostName = "Someone";
  let totalStr = "0.00";
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
        // Can't get payments from public endpoint, show member count instead
      }
    }
  } catch {
    // defaults
  }

  const fonts = [
    ...(fontData ? [{ name: "IBM Plex Sans Thai", data: fontData, style: "normal" as const, weight: 700 as const }] : []),
    ...(caveatData ? [{ name: "Caveat", data: caveatData, style: "normal" as const, weight: 700 as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%",
        background: "linear-gradient(135deg, #3d2810 0%, #5c3d2e 50%, #7d5a3e 100%)",
        fontFamily: '"IBM Plex Sans Thai", sans-serif',
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "50px 60px",
        position: "relative",
      }}>

        {/* Warm glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex",
          backgroundImage: "radial-gradient(ellipse at 30% 40%, rgba(196,149,106,0.2) 0%, transparent 55%)",
        }} />

        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: 35, left: 35, display: "flex" }}>
          <svg width="30" height="30" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.25)" strokeWidth="2" /><circle cx="3" cy="3" r="2" fill="rgba(232,213,191,0.25)" /></svg>
        </div>
        <div style={{ position: "absolute", bottom: 35, right: 35, display: "flex", transform: "rotate(180deg)" }}>
          <svg width="30" height="30" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.25)" strokeWidth="2" /><circle cx="3" cy="3" r="2" fill="rgba(232,213,191,0.25)" /></svg>
        </div>

        {/* Catfish watermark */}
        <div style={{ position: "absolute", right: "60px", top: "50%", transform: "translateY(-50%)", display: "flex", opacity: 0.06 }}>
          <svg width="250" height="125" viewBox="0 0 340 160" fill="none" stroke="#C4956A" strokeLinecap="round" strokeLinejoin="round">
            <g transform="translate(170, 80)">
              <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
              <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
              <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
              <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
              <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
              <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
              <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
              <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
              <circle cx="-35" cy="-6" r="6.5" fill="#C4956A" stroke="none" />
            </g>
          </svg>
        </div>

        {/* Top: branding */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span style={{ fontFamily: "Caveat", fontSize: "36px", color: "#C4956A" }}>Pladuk</span>
          <span style={{ fontSize: "16px", color: "rgba(196,149,106,0.5)" }}>หารบิลง่ายๆ</span>
        </div>

        {/* Center: room info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "14px", color: "rgba(196,149,106,0.6)", letterSpacing: "5px", fontWeight: 700 }}>BILL SPLIT RECAP</span>
          <span style={{ fontSize: "48px", fontWeight: 700, color: "#faf7f3", lineHeight: 1.15, letterSpacing: "-1px" }}>
            {roomName.length > 25 ? roomName.slice(0, 25) + "..." : roomName}
          </span>
          <span style={{ fontSize: "20px", color: "rgba(196,149,106,0.7)" }}>
            {hostName} · {memberCount} members · All settled
          </span>
        </div>

        {/* Bottom: CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#C4956A", fontSize: "16px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12L10 17L19 7" /></svg>
            <span>All Settled</span>
          </div>
          <span style={{ fontSize: "16px", color: "rgba(196,149,106,0.4)", fontFamily: "Caveat" }}>pladuk.online</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
