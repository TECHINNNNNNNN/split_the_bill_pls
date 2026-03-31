import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaDuk — Bill Split";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont() {
  const res = await fetch(
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600;700&display=swap"
  );
  const css = await res.text();
  const fontUrl = css.match(/src: url\(([^)]+)\)/)?.[1];
  if (!fontUrl) return null;
  const fontRes = await fetch(fontUrl);
  return fontRes.arrayBuffer();
}

export default async function Image({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const fontData = await loadFont();

  let roomName = "Bill Split";
  let hostName = "Someone";
  let memberCount = 0;
  let expectedMembers = 0;
  let status = "waiting";

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const res = await fetch(`${apiUrl}/api/rooms/code/${code}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      roomName = data.room?.name || `${data.room?.hostName}'s Split`;
      hostName = data.room?.hostName || "Someone";
      memberCount = data.room?.members?.length || 0;
      expectedMembers = data.room?.expectedMembers || 0;
      status = data.room?.status || "waiting";
    }
  } catch {
    // Use defaults
  }

  const statusLabels: Record<string, string> = {
    waiting: "Waiting for friends",
    splitting: "Splitting the bill",
    payment: "Collecting payments",
    settled: "All settled!",
  };

  const memberDotColors = [
    "#8B6914", "#B08A56", "#6D8B5E", "#C49A3C",
    "#9B7A6E", "#6A8BA0", "#C47A5A", "#A06B7A",
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 70px",
          background: "#f5f0eb",
          fontFamily: '"IBM Plex Sans Thai", sans-serif',
          position: "relative",
        }}
      >
        {/* Subtle grain-like texture overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.04,
            backgroundImage: "radial-gradient(circle at 25% 45%, #C4956A 0%, transparent 55%), radial-gradient(circle at 75% 25%, #C4956A 0%, transparent 50%)",
          }}
        />

        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: 40, left: 40, display: "flex" }}>
          <svg width="40" height="40" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill="#E8D5BF" />
          </svg>
        </div>
        <div style={{ position: "absolute", bottom: 40, right: 40, display: "flex", transform: "rotate(180deg)" }}>
          <svg width="40" height="40" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill="#E8D5BF" />
          </svg>
        </div>

        {/* Top: branding + status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                fontWeight: 700,
                color: "#3d2810",
                letterSpacing: "-0.5px",
              }}
            >
              Pladuk
            </div>
            <div
              style={{
                fontSize: "16px",
                color: "#C4956A",
                fontStyle: "italic",
              }}
            >
              หารบิลง่ายๆ
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#5c3d2e",
              color: "#faf7f3",
              padding: "10px 24px",
              borderRadius: "99px",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            {statusLabels[status] || status}
          </div>
        </div>

        {/* Center: room info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#3d2810",
              lineHeight: 1.2,
              letterSpacing: "-1px",
            }}
          >
            {roomName.length > 30 ? roomName.slice(0, 30) + "..." : roomName}
          </div>
          <div
            style={{
              fontSize: "22px",
              color: "#8B6914",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <span>Hosted by {hostName}</span>
            <span style={{ color: "#C4956A" }}>·</span>
            <span>
              {memberCount}/{expectedMembers} joined
            </span>
          </div>
        </div>

        {/* Bottom: member dots + CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            {Array.from({ length: Math.min(memberCount, 8) }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: memberDotColors[i % 8],
                  border: "3px solid #f5f0eb",
                }}
              />
            ))}
            {memberCount > 8 && (
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#C4956A",
                  border: "3px solid #f5f0eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#faf7f3",
                }}
              >
                +{memberCount - 8}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#C4956A",
              fontSize: "18px",
              fontStyle: "italic",
            }}
          >
            Tap to join →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [
            {
              name: "IBM Plex Sans Thai",
              data: fontData,
              style: "normal" as const,
              weight: 600 as const,
            },
          ]
        : [],
    }
  );
}
