import { ImageResponse } from "next/og";
import { PALETTE } from "@/lib/palette";

// The home-screen icon (iPhone and Android): the Bursr mark, full bleed.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: PALETTE.ledger }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M11 7.5v17" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="16.8" cy="18.6" r="5.8" fill="none" stroke="#fff" strokeWidth="3.4" />
          <path d="M16.8 16c.27 1.6 1 2.33 2.6 2.6-1.6.27-2.33 1-2.6 2.6-.27-1.6-1-2.33-2.6-2.6 1.6-.27 2.33-1 2.6-2.6z" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
