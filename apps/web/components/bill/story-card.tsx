"use client";

import { forwardRef } from "react";

interface StoryMember {
  displayName: string;
  image?: string | null;
  amount: number;
  claimedAt?: string | null;
}

interface StoryItem {
  name: string;
  splitCount: number;
}

interface StoryCardProps {
  roomName: string;
  date: string;
  totalAmount: number;
  members: StoryMember[];
  items: StoryItem[];
  finalizedAt?: string | null;
}

// ─── Custom SVG icons (no emojis) ───

function CrownIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18L5 8L9.5 12L12 4L14.5 12L19 8L21 18H3Z" />
      <path d="M3 18H21" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4 14H12L11 22L20 10H12L13 2Z" />
    </svg>
  );
}

function PlateIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4956A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="14" rx="9" ry="4" />
      <path d="M3 14C3 11 7 9 12 9C17 9 21 11 21 14" />
      <path d="M12 5V9" />
      <path d="M10 5C10 4 10.5 3 12 3C13.5 3 14 4 14 5" />
    </svg>
  );
}

function CatfishWatermark() {
  return (
    <svg width="320" height="160" viewBox="0 0 340 160" fill="none" stroke="#3d2810" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.04 }}>
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
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12L10 17L19 7" />
    </svg>
  );
}

// ─── Main component ───

export const StoryCard = forwardRef<HTMLDivElement, StoryCardProps>(
  function StoryCard({ roomName, date, totalAmount, members, items, finalizedAt }, ref) {
    const bigSpender = members.length > 0
      ? members.reduce((max, m) => (m.amount > max.amount ? m : max), members[0])
      : null;

    const fastestPayer = finalizedAt
      ? members
          .filter((m) => m.claimedAt)
          .sort((a, b) => {
            const aTime = new Date(a.claimedAt!).getTime() - new Date(finalizedAt).getTime();
            const bTime = new Date(b.claimedAt!).getTime() - new Date(finalizedAt).getTime();
            return aTime - bTime;
          })[0] ?? null
      : null;

    const fastestPayerTime = fastestPayer && finalizedAt
      ? Math.max(0, Math.floor((new Date(fastestPayer.claimedAt!).getTime() - new Date(finalizedAt).getTime()) / 60000))
      : null;

    const mostPopularItem = items.length > 0
      ? items.reduce((max, item) => (item.splitCount > max.splitCount ? item : max), items[0])
      : null;

    const COLORS = [
      "#8B6914", "#B08A56", "#6D8B5E", "#C49A3C",
      "#9B7A6E", "#6A8BA0", "#C47A5A", "#A06B7A",
    ];

    return (
      <div
        ref={ref}
        style={{
          width: "1080px",
          height: "1920px",
          background: "#f5f0eb",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#3d2810",
          display: "flex",
          flexDirection: "column",
          padding: "100px 80px 80px",
          position: "fixed",
          left: "0",
          top: "0",
          pointerEvents: "none" as const,
          zIndex: -1,
          clipPath: "inset(50%)",
          overflow: "hidden",
        }}
      >
        {/* Grain texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='0.04'/%3E%3C/svg%3E")`,
            backgroundSize: "180px",
            pointerEvents: "none" as const,
          }}
        />

        {/* Catfish watermark — large, centered, very subtle */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <CatfishWatermark />
        </div>

        {/* Corner ornaments */}
        {[
          { top: 50, left: 50, rotate: "0deg" },
          { top: 50, right: 50, rotate: "90deg" },
          { bottom: 50, left: 50, rotate: "-90deg" },
          { bottom: 50, right: 50, rotate: "180deg" },
        ].map((pos, i) => (
          <div key={i} style={{ position: "absolute", ...pos, display: "flex", transform: `rotate(${pos.rotate})` } as React.CSSProperties}>
            <svg width="50" height="50" viewBox="0 0 65 65" fill="none">
              <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="1.5" />
              <circle cx="3" cy="3" r="1.5" fill="#E8D5BF" />
            </svg>
          </div>
        ))}

        {/* Decorative line */}
        <div style={{ width: "50px", height: "1.5px", background: "#C4956A", margin: "0 auto" }} />

        {/* Branding — bilingual */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginTop: "36px" }}>
          <div style={{ fontSize: "40px", fontWeight: 700, letterSpacing: "-0.5px" }}>
            Pladuk
          </div>
          <div style={{ fontSize: "20px", color: "#C4956A", fontStyle: "italic", letterSpacing: "1px" }}>
            หารบิลง่ายๆ
          </div>
        </div>

        {/* Room name */}
        <div style={{ marginTop: "90px" }}>
          <div style={{ fontSize: "22px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "5px", fontWeight: 500 }}>
            Bill Split
          </div>
          <div
            style={{
              fontSize: "68px",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-2px",
              marginTop: "12px",
              maxWidth: "880px",
            }}
          >
            {roomName.length > 22 ? roomName.slice(0, 22) + "..." : roomName}
          </div>
          <div style={{ fontSize: "26px", color: "#8B6914", marginTop: "14px", fontStyle: "italic" }}>
            {date}
          </div>
        </div>

        {/* Hero amount — THE Spotify Wrapped moment */}
        <div style={{ marginTop: "80px" }}>
          <div style={{ fontSize: "120px", fontWeight: 800, letterSpacing: "-4px", lineHeight: 1 }}>
            ฿{totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: "24px", color: "#8B6914", marginTop: "12px", letterSpacing: "1px" }}>
            split between {members.length} friends · {items.length} items
          </div>
        </div>

        {/* Thin divider */}
        <div style={{ width: "100%", height: "1px", background: "rgba(92, 61, 46, 0.1)", marginTop: "56px" }} />

        {/* Stats — custom SVG icons, no emojis */}
        <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "36px" }}>
          {bigSpender && (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(196, 149, 106, 0.1)",
                  border: "1px solid rgba(196, 149, 106, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CrownIcon />
              </div>
              <div>
                <div style={{ fontSize: "16px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "4px", fontWeight: 500 }}>
                  Big Spender
                </div>
                <div style={{ fontSize: "30px", fontWeight: 600, marginTop: "4px" }}>
                  {bigSpender.displayName}
                  <span style={{ color: "#8B6914", fontWeight: 400, marginLeft: "10px", fontSize: "26px" }}>
                    ฿{bigSpender.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {fastestPayer && fastestPayerTime !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(196, 149, 106, 0.1)",
                  border: "1px solid rgba(196, 149, 106, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <LightningIcon />
              </div>
              <div>
                <div style={{ fontSize: "16px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "4px", fontWeight: 500 }}>
                  Fastest Payer
                </div>
                <div style={{ fontSize: "30px", fontWeight: 600, marginTop: "4px" }}>
                  {fastestPayer.displayName}
                  <span style={{ color: "#8B6914", fontWeight: 400, marginLeft: "10px", fontSize: "26px" }}>
                    {fastestPayerTime < 1 ? "instantly" : `${fastestPayerTime}m`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {mostPopularItem && mostPopularItem.splitCount > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(196, 149, 106, 0.1)",
                  border: "1px solid rgba(196, 149, 106, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlateIcon />
              </div>
              <div>
                <div style={{ fontSize: "16px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "4px", fontWeight: 500 }}>
                  Most Popular
                </div>
                <div style={{ fontSize: "30px", fontWeight: 600, marginTop: "4px" }}>
                  {mostPopularItem.name}
                  <span style={{ color: "#8B6914", fontWeight: 400, marginLeft: "10px", fontSize: "26px" }}>
                    {mostPopularItem.splitCount} people
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom section — pushed to bottom */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "28px" }}>
          {/* Member avatars */}
          <div style={{ display: "flex", gap: "10px" }}>
            {members.slice(0, 8).map((member, i) => (
              <div
                key={i}
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  backgroundColor: COLORS[i % COLORS.length],
                  border: "2.5px solid #f5f0eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#faf7f3",
                }}
              >
                {member.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Footer — subtle branding + settled badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "20px", color: "#C4956A", fontStyle: "italic", letterSpacing: "0.5px" }}>
              pladuk.online
            </div>
            <div
              style={{
                fontSize: "18px",
                color: "#4a9e6e",
                fontWeight: 600,
                padding: "8px 22px",
                borderRadius: "99px",
                border: "1px solid rgba(74, 158, 110, 0.25)",
                background: "rgba(74, 158, 110, 0.06)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckIcon />
              All Settled
            </div>
          </div>
        </div>
      </div>
    );
  }
);
