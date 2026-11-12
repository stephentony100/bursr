import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PALETTE } from "@/lib/palette";

// The picture shown when a Bursr link is shared (WhatsApp, X, LinkedIn, Slack).
export const alt = "Bursr: the AI payroll agent for small businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The wordmark is Plus Jakarta Sans 800 (OFL, from Fontsource), loaded for the image renderer
// the way Next's docs do it: from a project folder, by path.
const fontFile = (name: string) => readFile(join(process.cwd(), "assets/fonts", name));

export default async function OpengraphImage() {
  const [w800, w700] = await Promise.all([fontFile("plus-jakarta-sans-latin-800-normal.woff"), fontFile("plus-jakarta-sans-latin-700-normal.woff")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, fontFamily: "Jakarta", background: PALETTE.night, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="3 3 42 42">
            <rect x="3" y="3" width="42" height="42" rx="12" fill={PALETTE.card} />
            <g fill="none" stroke={PALETTE.ink} strokeWidth="3.2" strokeLinecap="round">
              <path d="M16 24C22 24 24 15 30 15" />
              <path d="M16 24L31 24" />
              <path d="M16 24C22 24 24 33 30 33" />
            </g>
            <circle cx="15" cy="24" r="5" fill={PALETTE.ink} />
            <circle cx="33.5" cy="15" r="3.6" fill={PALETTE.ledger} />
            <circle cx="34.5" cy="24" r="3.6" fill={PALETTE.ledger} />
            <circle cx="33.5" cy="33" r="3.6" fill={PALETTE.ledger} />
          </svg>
          <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2.3 }}>Bursr</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>Your AI payroll agent.</span>
          <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, color: PALETTE["ledger-bright"] }}>Never the wrong person.</span>
        </div>
        <span style={{ fontSize: 28, color: PALETTE["paper-2"], opacity: 0.7 }}>Pays your staff and suppliers in digital dollars, on any network, inside limits it can&apos;t change.</span>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: w800, weight: 800, style: "normal" },
        { name: "Jakarta", data: w700, weight: 700, style: "normal" },
      ],
    },
  );
}
