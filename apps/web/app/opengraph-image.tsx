import { ImageResponse } from "next/og";
import { PALETTE } from "@/lib/palette";

// The picture shown when a Bursr link is shared (WhatsApp, X, LinkedIn, Slack).
export const alt = "Bursr: the AI payroll agent for small businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: PALETTE.night, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill={PALETTE.ledger} />
            <path d="M11 7.5v17" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
            <circle cx="16.8" cy="18.6" r="5.8" fill="none" stroke="#fff" strokeWidth="3.4" />
            <path d="M16.8 16c.27 1.6 1 2.33 2.6 2.6-1.6.27-2.33 1-2.6 2.6-.27-1.6-1-2.33-2.6-2.6 1.6-.27 2.33-1 2.6-2.6z" fill="#fff" />
          </svg>
          <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: -2 }}>Bursr</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Your AI payroll agent.</span>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, color: PALETTE["ledger-bright"] }}>Never the wrong person.</span>
        </div>
        <span style={{ fontSize: 28, color: PALETTE["paper-2"], opacity: 0.7 }}>Pays your staff and suppliers in digital dollars, on any network, inside limits it can&apos;t change.</span>
      </div>
    ),
    size,
  );
}
