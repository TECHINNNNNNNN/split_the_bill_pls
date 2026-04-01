import { ImageResponse } from "next/og";

async function loadGoogleFont(weight: number) {
  try {
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@${weight}&display=swap`
    );
    const css = await res.text();
    const url = css.match(/src: url\(([^)]+)\)/)?.[1];
    if (!url) return null;
    return (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

// Satori rule: EVERY div with multiple children needs display:"flex"

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.pathname.split("/").pop() || "unknown";

  const [fontRegular, fontBold] = await Promise.all([
    loadGoogleFont(400),
    loadGoogleFont(700),
  ]);
  const fonts = [
    ...(fontRegular ? [{ name: "IBM Plex Sans Thai", data: fontRegular, style: "normal" as const, weight: 400 as const }] : []),
    ...(fontBold ? [{ name: "IBM Plex Sans Thai", data: fontBold, style: "normal" as const, weight: 700 as const }] : []),
  ];

  // Fetch room data
  let roomName = "Bill Split";
  let date = "";
  let totalStr = "0.00";
  let memberCountStr = "0";
  let itemCountStr = "0";
  let bigSpenderName = "";
  let bigSpenderDetail = "";
  let fastestPayerName = "";
  let fastestPayerDetail = "";
  let mostPopularName = "";
  let mostPopularDetail = "";

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${apiUrl}/api/rooms/code/${code}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const room = data.room;
      if (room) {
        roomName = room.name || `${room.hostName}'s Split`;
        date = room.createdAt
          ? new Date(room.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          : "";
        const payments: { amount: string; memberId: string; claimedAt?: string }[] = room.payments || [];
        const members: { id: string; displayName: string }[] = room.members || [];
        const billItems: { name: string; splitCount?: number }[] = room.billItems || [];
        const total = payments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
        totalStr = total.toFixed(2);
        memberCountStr = String(payments.length);
        itemCountStr = String(billItems.length);

        if (payments.length > 0) {
          const sorted = [...payments].sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
          const m = members.find(m => m.id === sorted[0].memberId);
          bigSpenderName = m?.displayName || "";
          bigSpenderDetail = `฿${parseFloat(sorted[0].amount).toFixed(2)}`;
        }
        if (room.finalizedAt) {
          const claimed = payments.filter(p => p.claimedAt).sort((a, b) =>
            new Date(a.claimedAt!).getTime() - new Date(b.claimedAt!).getTime()
          );
          if (claimed.length > 0) {
            const m = members.find(m => m.id === claimed[0].memberId);
            fastestPayerName = m?.displayName || "";
            const mins = Math.max(0, Math.floor((new Date(claimed[0].claimedAt!).getTime() - new Date(room.finalizedAt).getTime()) / 60000));
            fastestPayerDetail = mins < 1 ? "instantly" : `${mins}m`;
          }
        }
        if (billItems.length > 0) {
          const popular = [...billItems].sort((a, b) => (b.splitCount || 0) - (a.splitCount || 0))[0];
          if (popular && (popular.splitCount || 0) > 1) {
            mostPopularName = popular.name;
            mostPopularDetail = `${popular.splitCount} people`;
          }
        }
      }
    }
  } catch {
    // defaults
  }

  // Build stats array
  const stats: { label: string; name: string; detail: string; iconPath: string }[] = [];
  if (bigSpenderName) stats.push({ label: "BIG SPENDER", name: bigSpenderName, detail: bigSpenderDetail, iconPath: "M3 18L5 8L9.5 12L12 4L14.5 12L19 8L21 18H3Z" });
  if (fastestPayerName) stats.push({ label: "FASTEST PAYER", name: fastestPayerName, detail: fastestPayerDetail, iconPath: "M13 2L4 14H12L11 22L20 10H12L13 2Z" });
  if (mostPopularName) stats.push({ label: "MOST POPULAR", name: mostPopularName, detail: mostPopularDetail, iconPath: "M3 14C3 11 7 9 12 9C17 9 21 11 21 14C21 16.2 17 18 12 18C7 18 3 16.2 3 14Z" });

  const displayName = roomName.length > 20 ? roomName.slice(0, 20) + "..." : roomName;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#f5f0eb", fontFamily: '"IBM Plex Sans Thai", sans-serif', color: "#3d2810", display: "flex", flexDirection: "column", padding: "120px 90px 100px", position: "relative" }}>

        {/* Catfish watermark */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", opacity: 0.035 }}>
          <svg width="400" height="200" viewBox="0 0 340 160" fill="none" stroke="#3d2810" strokeLinecap="round" strokeLinejoin="round">
            <g transform="translate(170, 80)">
              <path d="M -65 -8 C -60 -40, -20 -50, 25 -46 C 60 -42, 95 -28, 118 -6" strokeWidth="3.2" />
              <path d="M -65 8 C -55 42, -5 55, 40 48 C 72 42, 98 26, 118 6" strokeWidth="2.8" />
              <path d="M -65 -8 C -72 -4, -72 4, -65 8" strokeWidth="3" />
              <path d="M 116 -4 C 138 -32, 158 -38, 170 -24" strokeWidth="3" />
              <path d="M 116 4 C 138 32, 158 38, 170 24" strokeWidth="3" />
              <path d="M -68 2 C -100 -8, -138 -4, -168 -14" strokeWidth="3.2" />
              <path d="M -68 6 C -98 14, -135 18, -162 12" strokeWidth="2.5" />
              <path d="M -66 9 C -88 28, -118 34, -150 36" strokeWidth="1.8" />
              <circle cx="-35" cy="-6" r="6.5" fill="#3d2810" stroke="none" />
            </g>
          </svg>
        </div>

        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: 55, left: 55, display: "flex" }}>
          <svg width="45" height="45" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="#E8D5BF" /></svg>
        </div>
        <div style={{ position: "absolute", top: 55, right: 55, display: "flex", transform: "rotate(90deg)" }}>
          <svg width="45" height="45" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="#E8D5BF" /></svg>
        </div>
        <div style={{ position: "absolute", bottom: 55, left: 55, display: "flex", transform: "rotate(-90deg)" }}>
          <svg width="45" height="45" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="#E8D5BF" /></svg>
        </div>
        <div style={{ position: "absolute", bottom: 55, right: 55, display: "flex", transform: "rotate(180deg)" }}>
          <svg width="45" height="45" viewBox="0 0 65 65" fill="none"><path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.5" /><circle cx="3" cy="3" r="1.5" fill="#E8D5BF" /></svg>
        </div>

        {/* Decorative line */}
        <div style={{ width: "50px", height: "2px", background: "#C4956A", display: "flex", alignSelf: "center" }} />

        {/* Branding */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginTop: "40px" }}>
          <span style={{ fontSize: "42px", fontWeight: 700 }}>Pladuk</span>
          <span style={{ fontSize: "22px", color: "#C4956A" }}>หารบิลง่ายๆ</span>
        </div>

        {/* Room name + date */}
        <div style={{ marginTop: "100px", display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "20px", color: "#C4956A", letterSpacing: "5px", fontWeight: 700 }}>BILL SPLIT</span>
          <span style={{ fontSize: "64px", fontWeight: 700, marginTop: "12px" }}>{displayName}</span>
          <span style={{ fontSize: "26px", color: "#8B6914", marginTop: "12px" }}>{date}</span>
        </div>

        {/* Hero amount */}
        <div style={{ marginTop: "80px", display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: "110px", fontWeight: 700, letterSpacing: "-3px", lineHeight: 1 }}>{`฿${totalStr}`}</span>
          <span style={{ fontSize: "24px", color: "#8B6914", marginTop: "14px" }}>{`split between ${memberCountStr} friends · ${itemCountStr} items`}</span>
        </div>

        {/* Divider */}
        <div style={{ width: "100%", height: "1px", background: "rgba(92,61,46,0.1)", marginTop: "60px", display: "flex" }} />

        {/* Stats */}
        <div style={{ marginTop: "50px", display: "flex", flexDirection: "column", gap: "36px" }}>
          {stats.map((stat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "26px", background: "rgba(196,149,106,0.1)", border: "1px solid rgba(196,149,106,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={stat.iconPath} />
                </svg>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "15px", color: "#C4956A", letterSpacing: "4px", fontWeight: 700 }}>{stat.label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "4px" }}>
                  <span style={{ fontSize: "28px", fontWeight: 700 }}>{stat.name}</span>
                  <span style={{ color: "#8B6914", fontSize: "24px" }}>{stat.detail}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "20px", color: "#C4956A" }}>pladuk.online</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "17px", color: "#4a9e6e", fontWeight: 700, padding: "8px 22px", borderRadius: "99px", border: "1px solid rgba(74,158,110,0.25)", background: "rgba(74,158,110,0.06)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a9e6e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12L10 17L19 7" /></svg>
            <span>All Settled</span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts }
  );
}
