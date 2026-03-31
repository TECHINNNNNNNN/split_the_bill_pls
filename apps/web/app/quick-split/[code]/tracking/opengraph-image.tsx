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
            ? "linear-gradient(135deg, #4a9e6e 0%, #3d8a5e 50%, #4a9e6e 100%)"
            : "#f5f0eb",
          fontFamily: '"IBM Plex Sans Thai", sans-serif',
          position: "relative",
        }}
      >
        {/* Warm radial accents */}
        {!isSettled && (
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
        )}

        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: 40, left: 40, display: "flex" }}>
          <svg width="40" height="40" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke={isSettled ? "rgba(255,255,255,0.3)" : "#E8D5BF"} strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill={isSettled ? "rgba(255,255,255,0.3)" : "#E8D5BF"} />
          </svg>
        </div>
        <div style={{ position: "absolute", bottom: 40, right: 40, display: "flex", transform: "rotate(180deg)" }}>
          <svg width="40" height="40" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke={isSettled ? "rgba(255,255,255,0.3)" : "#E8D5BF"} strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill={isSettled ? "rgba(255,255,255,0.3)" : "#E8D5BF"} />
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
                color: isSettled ? "#faf7f3" : "#3d2810",
                letterSpacing: "-0.5px",
              }}
            >
              Pladuk
            </div>
            <div
              style={{
                fontSize: "16px",
                color: isSettled ? "rgba(255,255,255,0.7)" : "#C4956A",
                fontStyle: "italic",
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
              backgroundColor: isSettled ? "rgba(255,255,255,0.2)" : "#5c3d2e",
              color: isSettled ? "#faf7f3" : "#faf7f3",
              padding: "10px 24px",
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
              color: isSettled ? "#faf7f3" : "#3d2810",
              lineHeight: 1.2,
              letterSpacing: "-1px",
            }}
          >
            {roomName.length > 30 ? roomName.slice(0, 30) + "..." : roomName}
          </div>
          <div
            style={{
              fontSize: "22px",
              color: isSettled ? "rgba(255,255,255,0.7)" : "#8B6914",
            }}
          >
            {hostName} is collecting · {memberCount} members
          </div>
        </div>

        {/* Bottom: progress bar + CTA */}
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
                backgroundColor: isSettled ? "rgba(255,255,255,0.2)" : "#e0ccb0",
                borderRadius: "99px",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div
                style={{
                  width: isSettled ? "100%" : "40%",
                  height: "100%",
                  background: isSettled
                    ? "rgba(255,255,255,0.6)"
                    : "linear-gradient(90deg, #8B6914, #5c3d2e)",
                  borderRadius: "99px",
                }}
              />
            </div>
          </div>

          <div
            style={{
              color: isSettled ? "rgba(255,255,255,0.7)" : "#C4956A",
              fontSize: "18px",
              fontStyle: "italic",
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
