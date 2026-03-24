import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaDuk — Bill Split";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Load font for Thai text rendering
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

  // Fetch room data
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

  const statusColors: Record<string, string> = {
    waiting: "#fbbf24",
    splitting: "#60a5fa",
    payment: "#34d399",
    settled: "#22c55e",
  };

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: '"IBM Plex Sans Thai", sans-serif',
        }}
      >
        {/* Top: branding */}
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
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#f8fafc",
                letterSpacing: "-0.5px",
              }}
            >
              PlaDuk
            </div>
            <div
              style={{
                fontSize: "16px",
                color: "#64748b",
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
              backgroundColor: statusColors[status] || "#64748b",
              color: "#0f172a",
              padding: "8px 20px",
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
              color: "#f8fafc",
              lineHeight: 1.2,
              letterSpacing: "-1px",
            }}
          >
            {roomName.length > 30 ? roomName.slice(0, 30) + "..." : roomName}
          </div>
          <div
            style={{
              fontSize: "24px",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <span>Hosted by {hostName}</span>
            <span style={{ color: "#475569" }}>•</span>
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
          {/* Member dots */}
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
                  backgroundColor: ["#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22", "#E91E63"][i % 8],
                  border: "3px solid #1e293b",
                }}
              />
            ))}
            {memberCount > 8 && (
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#475569",
                  border: "3px solid #1e293b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#f8fafc",
                }}
              >
                +{memberCount - 8}
              </div>
            )}
          </div>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#64748b",
              fontSize: "18px",
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
