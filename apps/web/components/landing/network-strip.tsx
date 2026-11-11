"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

// "Pays out on": the networks people can be paid on, sliding past in a loop.
// Names only (no third-party logos); the dot colours are our own.

const NETWORKS = [
  ["NEAR", "#0b1220"],
  ["Base", "#2f4bdb"],
  ["Solana", "#7c3aed"],
  ["Tron", "#d92d20"],
  ["Ethereum", "#475569"],
  ["Arbitrum", "#2563eb"],
  ["Polygon", "#8b5cf6"],
  ["BNB Chain", "#ca8a04"],
  ["Optimism", "#ef4444"],
  ["Avalanche", "#dc2626"],
  ["Sui", "#0ea5e9"],
] as const;

export function NetworkStrip() {
  const track = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion() || !track.current) return;
      gsap.to(track.current, { xPercent: -50, ease: "none", duration: 38, repeat: -1 });
    },
    { scope: track },
  );
  const row = [...NETWORKS, ...NETWORKS];
  return (
    <section aria-label="Networks people can be paid on" className="border-y border-line bg-card py-6">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-6 px-5">
        <p className="shrink-0 text-sm font-semibold text-muted">Pays out in USDC and USDT on</p>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div ref={track} className="flex w-max gap-3">
            {row.map(([name, color], i) => (
              <span key={`${name}-${i}`} aria-hidden={i >= NETWORKS.length} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
