import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PlaDuk — Payment Tracking";
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
  let status = "payment";

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
      status = data.room?.status || "payment";
    }
  } catch {
    // Use defaults
  }

  const isSettled = status === "settled";

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
          background: isSettled
            ? "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #064e3b 100%)"
            : "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: '"IBM Plex Sans Thai", sans-serif',
        }}
      >
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
                color: isSettled ? "#6ee7b7" : "#64748b",
              }}
            >
              {isSettled ? "All settled!" : "Payment tracking"}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: isSettled ? "#22c55e" : "#f59e0b",
              color: "#0f172a",
              padding: "8px 20px",
              borderRadius: "99px",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            {isSettled ? "Settled ✓" : "Collecting payments"}
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
              color: isSettled ? "#a7f3d0" : "#94a3b8",
            }}
          >
            {hostName} is collecting • {memberCount} members
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Progress bar placeholder */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              flex: 1,
              marginRight: "40px",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "12px",
                backgroundColor: isSettled ? "#065f46" : "#1e293b",
                borderRadius: "99px",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  width: isSettled ? "100%" : "40%",
                  height: "100%",
                  backgroundColor: isSettled ? "#22c55e" : "#f59e0b",
                  borderRadius: "99px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              color: isSettled ? "#6ee7b7" : "#64748b",
              fontSize: "18px",
            }}
          >
            {isSettled ? "Everyone has paid!" : "Tap to see your share →"}
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
