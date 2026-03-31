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
          padding: "80px 70px",
          position: "fixed",
          left: "0",
          top: "0",
          pointerEvents: "none" as const,
          zIndex: -1,
          clipPath: "inset(50%)",
        }}
      >
        {/* Corner ornaments */}
        <div style={{ position: "absolute", top: 50, left: 50, display: "flex" }}>
          <svg width="50" height="50" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill="#E8D5BF" />
          </svg>
        </div>
        <div style={{ position: "absolute", top: 50, right: 50, display: "flex", transform: "rotate(90deg)" }}>
          <svg width="50" height="50" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill="#E8D5BF" />
          </svg>
        </div>
        <div style={{ position: "absolute", bottom: 50, left: 50, display: "flex", transform: "rotate(-90deg)" }}>
          <svg width="50" height="50" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill="#E8D5BF" />
          </svg>
        </div>
        <div style={{ position: "absolute", bottom: 50, right: 50, display: "flex", transform: "rotate(180deg)" }}>
          <svg width="50" height="50" viewBox="0 0 65 65" fill="none">
            <path d="M 0 32 L 0 0 L 32 0" stroke="#E8D5BF" strokeWidth="2" />
            <circle cx="3" cy="3" r="2" fill="#E8D5BF" />
          </svg>
        </div>

        {/* Decorative line */}
        <div style={{ width: "60px", height: "2px", background: "#C4956A", margin: "0 auto" }} />

        {/* Top: Branding */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px", marginTop: "40px" }}>
          <div style={{ fontSize: "48px", fontWeight: 700, letterSpacing: "-1px" }}>
            Pladuk
          </div>
          <div style={{ fontSize: "24px", color: "#C4956A", fontStyle: "italic" }}>
            หารบิลง่ายๆ
          </div>
        </div>

        {/* Room name + date */}
        <div style={{ marginTop: "100px" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-2px",
              maxWidth: "900px",
            }}
          >
            {roomName.length > 25 ? roomName.slice(0, 25) + "..." : roomName}
          </div>
          <div style={{ fontSize: "28px", color: "#C4956A", marginTop: "16px", fontStyle: "italic" }}>
            {date}
          </div>
        </div>

        {/* Total */}
        <div
          style={{
            marginTop: "80px",
            padding: "40px 50px",
            background: "rgba(92, 61, 46, 0.06)",
            borderRadius: "24px",
            border: "1px solid rgba(92, 61, 46, 0.12)",
          }}
        >
          <div style={{ fontSize: "22px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "4px" }}>
            Total
          </div>
          <div style={{ fontSize: "80px", fontWeight: 700, marginTop: "8px", letterSpacing: "-2px" }}>
            ฿{totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: "24px", color: "#8B6914", marginTop: "8px" }}>
            {members.length} friends · {items.length} items
          </div>
        </div>

        {/* Fun stats */}
        <div style={{ marginTop: "60px", display: "flex", flexDirection: "column", gap: "32px" }}>
          {bigSpender && (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(196, 149, 106, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                👑
              </div>
              <div>
                <div style={{ fontSize: "18px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "3px" }}>
                  Big Spender
                </div>
                <div style={{ fontSize: "32px", fontWeight: 600, marginTop: "4px" }}>
                  {bigSpender.displayName} — ฿{bigSpender.amount.toFixed(2)}
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
                  background: "rgba(196, 149, 106, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                ⚡
              </div>
              <div>
                <div style={{ fontSize: "18px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "3px" }}>
                  Fastest Payer
                </div>
                <div style={{ fontSize: "32px", fontWeight: 600, marginTop: "4px" }}>
                  {fastestPayer.displayName} — {fastestPayerTime < 1 ? "instantly" : `${fastestPayerTime}m`}
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
                  background: "rgba(196, 149, 106, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                🍽️
              </div>
              <div>
                <div style={{ fontSize: "18px", color: "#C4956A", textTransform: "uppercase" as const, letterSpacing: "3px" }}>
                  Most Popular
                </div>
                <div style={{ fontSize: "32px", fontWeight: 600, marginTop: "4px" }}>
                  {mostPopularItem.name} ({mostPopularItem.splitCount} people)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Member avatars + footer */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            {members.slice(0, 8).map((member, i) => (
              <div
                key={i}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: COLORS[i % COLORS.length],
                  border: "3px solid #f5f0eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#faf7f3",
                  overflow: "hidden",
                }}
              >
                {member.displayName.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "22px", color: "#C4956A", fontStyle: "italic" }}>
              pladuk.online
            </div>
            <div
              style={{
                fontSize: "20px",
                color: "#4a9e6e",
                fontWeight: 600,
                padding: "8px 24px",
                borderRadius: "99px",
                border: "1px solid rgba(74, 158, 110, 0.3)",
                background: "rgba(74, 158, 110, 0.08)",
              }}
            >
              All Settled ✓
            </div>
          </div>
        </div>
      </div>
    );
  }
);
