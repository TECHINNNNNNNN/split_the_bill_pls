import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

async function loadGoogleFont(family: string, weight: number) {
  try {
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
    );
    const css = await res.text();
    const url = css.match(/src: url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

async function loadLocalFont(filename: string) {
  try {
    const buffer = await readFile(join(process.cwd(), "app/fonts", filename));
    return buffer.buffer as ArrayBuffer;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json() as {
    roomName: string;
    date: string;
    total: string;
    memberCount: string;
    itemCount: string;
    stats: { label: string; name: string; detail: string; icon: string }[];
    members?: { initial: string; color: string }[];
  };

  const [sansBold, caveat, instrumentSerif] = await Promise.all([
    loadGoogleFont("IBM Plex Sans Thai", 700),
    loadGoogleFont("Caveat", 700),
    loadLocalFont("InstrumentSerif-Italic.ttf"),
  ]);

  const fonts = [
    ...(sansBold ? [{ name: "sans", data: sansBold, style: "normal" as const, weight: 700 as const }] : []),
    ...(caveat ? [{ name: "caveat", data: caveat, style: "normal" as const, weight: 700 as const }] : []),
    ...(instrumentSerif ? [{ name: "serif", data: instrumentSerif, style: "italic" as const, weight: 400 as const }] : []),
  ];

  const iconPaths: Record<string, string> = {
    crown: "M3 18L5 8L9.5 12L12 4L14.5 12L19 8L21 18H3Z",
    lightning: "M13 2L4 14H12L11 22L20 10H12L13 2Z",
    plate: "M3 14C3 11 7 9 12 9C17 9 21 11 21 14C21 16.2 17 18 12 18C7 18 3 16.2 3 14Z",
  };

  const displayName = body.roomName.length > 18 ? body.roomName.slice(0, 18) + "..." : body.roomName;
  const members = body.members || [];

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%",
        background: "linear-gradient(180deg, #3d2810 0%, #5c3d2e 45%, #7d5a3e 100%)",
        fontFamily: "sans, sans-serif",
        display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
      }}>

        {/* Warm radial glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex",
          backgroundImage: "radial-gradient(ellipse at 50% 25%, rgba(196,149,106,0.2) 0%, transparent 50%)",
        }} />

        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: 40, left: 40, display: "flex" }}>
          <svg width="36" height="36" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.2)" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="rgba(232,213,191,0.2)" /></svg>
        </div>
        <div style={{ position: "absolute", top: 40, right: 40, display: "flex", transform: "rotate(90deg)" }}>
          <svg width="36" height="36" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.2)" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="rgba(232,213,191,0.2)" /></svg>
        </div>
        <div style={{ position: "absolute", bottom: 40, left: 40, display: "flex", transform: "rotate(-90deg)" }}>
          <svg width="36" height="36" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.2)" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="rgba(232,213,191,0.2)" /></svg>
        </div>
        <div style={{ position: "absolute", bottom: 40, right: 40, display: "flex", transform: "rotate(180deg)" }}>
          <svg width="36" height="36" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="rgba(232,213,191,0.2)" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="rgba(232,213,191,0.2)" /></svg>
        </div>

        {/* ═══ TOP — branding ═══ */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", padding: "90px 90px 0" }}>
          <span style={{ fontFamily: "caveat", fontSize: "48px", color: "#C4956A" }}>Pladuk</span>
          <span style={{ fontFamily: "serif", fontSize: "18px", color: "rgba(196,149,106,0.5)", letterSpacing: "2px" }}>หารบิลง่ายๆ</span>
        </div>

        {/* ═══ ROOM NAME ═══ */}
        <div style={{ padding: "50px 90px 0", display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "16px", color: "rgba(196,149,106,0.6)", letterSpacing: "6px", fontWeight: 700 }}>BILL SPLIT</span>
          <span style={{ fontFamily: "serif", fontSize: "52px", color: "#faf7f3", marginTop: "8px", lineHeight: 1.1 }}>{displayName}</span>
          <span style={{ fontFamily: "caveat", fontSize: "22px", color: "rgba(196,149,106,0.7)", marginTop: "8px" }}>{body.date}</span>
        </div>

        {/* ═══ HERO AMOUNT ═══ */}
        <div style={{ padding: "50px 90px 0", display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "136px", fontWeight: 700, color: "#faf7f3", letterSpacing: "-4px", lineHeight: 1 }}>{`฿${body.total}`}</span>
          <span style={{ fontFamily: "serif", fontSize: "20px", color: "rgba(250,247,243,0.45)", marginTop: "10px" }}>{`split between ${body.memberCount} friends · ${body.itemCount} item${body.itemCount === "1" ? "" : "s"}`}</span>
        </div>

        {/* ═══ CREAM CARD — polaroid frame ═══ */}
        <div style={{
          margin: "44px 60px 0",
          background: "#f5f0eb",
          borderRadius: "28px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          position: "relative",
          overflow: "hidden",
        }}>

          {/* Center — catfish stamp + tagline */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            flex: 1, padding: "40px",
          }}>
            <svg width="340" height="170" viewBox="0 0 340 160" fill="none" stroke="#3d2810" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.1 }}>
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

            <span style={{ fontFamily: "serif", fontSize: "30px", color: "rgba(61,40,16,0.2)", marginTop: "20px" }}>split bills, not friendships</span>

            <div style={{ display: "flex", gap: "30px", marginTop: "16px", opacity: 0.25 }}>
              <svg width="80" height="8" viewBox="0 0 80 8" fill="none">
                <path d="M 2 5 C 18 2, 35 7, 50 4 S 70 6, 78 3" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <svg width="50" height="8" viewBox="0 0 50 8" fill="none">
                <path d="M 2 4 C 12 2, 25 6, 35 3 S 45 5, 48 4" stroke="#C4956A" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Bottom strip — stats + squad */}
          <div style={{
            borderTop: "1px solid rgba(196,149,106,0.15)",
            padding: "32px 48px 36px",
            display: "flex", flexDirection: "column", gap: "24px",
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {body.stats.map((stat, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "20px",
                    background: "rgba(196,149,106,0.08)", border: "1px solid rgba(196,149,106,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={iconPaths[stat.icon] || iconPaths.crown} />
                    </svg>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#C4956A", letterSpacing: "3px", fontWeight: 700 }}>{stat.label}</span>
                    <span style={{ fontSize: "20px", fontWeight: 700, color: "#3d2810" }}>{stat.name}</span>
                    <span style={{ fontFamily: "caveat", fontSize: "18px", color: "#8B6914" }}>{stat.detail}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Squad + branding */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "11px", color: "#C4956A", letterSpacing: "3px", fontWeight: 700 }}>THE SQUAD</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  {members.map((m, i) => (
                    <div key={i} style={{
                      width: "36px", height: "36px", borderRadius: "18px",
                      backgroundColor: m.color, border: "2px solid #f5f0eb",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: 700, color: "#faf7f3",
                    }}>
                      {m.initial}
                    </div>
                  ))}
                </div>
              </div>
              <span style={{ fontFamily: "caveat", fontSize: "18px", color: "rgba(196,149,106,0.4)" }}>~ PlaDukKhlongToei ~</span>
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{ padding: "20px 90px 65px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "serif", fontSize: "16px", color: "rgba(196,149,106,0.35)" }}>pladuk.online</span>
          <div style={{
            display: "flex", alignItems: "center", gap: "5px",
            fontFamily: "serif", fontSize: "13px", color: "rgba(196,149,106,0.5)",
            padding: "6px 16px", borderRadius: "99px",
            border: "1px solid rgba(196,149,106,0.15)",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(196,149,106,0.5)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12L10 17L19 7" /></svg>
            <span>All Settled</span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts }
  );
}
