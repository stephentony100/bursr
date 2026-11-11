import { ImageResponse } from "next/og";

// The picture shown when a Bursr link is shared (WhatsApp, X, LinkedIn, Slack).
export const alt = "Bursr: an AI agent that pays your staff and suppliers in digital dollars, inside limits you set";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#0b1220", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#2f4bdb" />
            <path d="M11 7.5v17" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
            <circle cx="16.8" cy="18.6" r="5.8" fill="none" stroke="#fff" strokeWidth="3.6" />
          </svg>
          <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: -2 }}>Bursr</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Pay everyone.</span>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, color: "#8ea0ff" }}>Never the wrong person.</span>
        </div>
        <span style={{ fontSize: 28, color: "#aab3c5" }}>An AI agent pays your staff and suppliers in digital dollars, inside limits it can&apos;t change.</span>
      </div>
    ),
    size,
  );
}
