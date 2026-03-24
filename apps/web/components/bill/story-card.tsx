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
    // Compute fun stats
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

    const COLORS = ["#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6", "#1ABC9C", "#E67E22", "#E91E63"];

    return (
      <div
        ref={ref}
        style={{
          width: "1080px",
          height: "1920px",
          background: "linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          padding: "80px 70px",
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
        }}
      >
        {/* Top: Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "42px", fontWeight: 700, letterSpacing: "-1px" }}>
            PlaDuk
          </div>
          <div style={{ fontSize: "24px", color: "#64748b" }}>
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
          <div style={{ fontSize: "28px", color: "#94a3b8", marginTop: "16px" }}>
            {date}
          </div>
        </div>

        {/* Total */}
        <div
          style={{
            marginTop: "80px",
            padding: "40px 50px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "24px",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ fontSize: "24px", color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "3px" }}>
            Total
          </div>
          <div style={{ fontSize: "80px", fontWeight: 700, marginTop: "8px", letterSpacing: "-2px" }}>
            ฿{totalAmount.toFixed(2)}
          </div>
          <div style={{ fontSize: "24px", color: "#64748b", marginTop: "8px" }}>
            {members.length} friends • {items.length} items
          </div>
        </div>

        {/* Fun stats */}
        <div style={{ marginTop: "60px", display: "flex", flexDirection: "column", gap: "32px" }}>
          {bigSpender && (
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ fontSize: "48px" }}>👑</div>
              <div>
                <div style={{ fontSize: "20px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "2px" }}>
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
              <div style={{ fontSize: "48px" }}>⚡</div>
              <div>
                <div style={{ fontSize: "20px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "2px" }}>
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
              <div style={{ fontSize: "48px" }}>🍽️</div>
              <div>
                <div style={{ fontSize: "20px", color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "2px" }}>
                  Most Popular
                </div>
                <div style={{ fontSize: "32px", fontWeight: 600, marginTop: "4px" }}>
                  {mostPopularItem.name} ({mostPopularItem.splitCount} people)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Member avatars */}
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
                  border: "3px solid #1e293b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: 700,
                  overflow: "hidden",
                }}
              >
                {member.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  member.displayName.charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "22px", color: "#475569" }}>
              pladuk.online
            </div>
            <div
              style={{
                fontSize: "20px",
                color: "#22c55e",
                fontWeight: 600,
                padding: "8px 24px",
                borderRadius: "99px",
                border: "1px solid rgba(34, 197, 94, 0.3)",
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
