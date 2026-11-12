"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

// "Pays out on": the networks people can be paid on, as their logos, sliding
// past in a loop. Logos from web3icons (MIT), saved in public/networks.

const NETWORKS = [
  ["near", "NEAR"],
  ["base", "Base"],
  ["solana", "Solana"],
  ["tron", "Tron"],
  ["ethereum", "Ethereum"],
  ["arbitrum", "Arbitrum"],
  ["polygon", "Polygon"],
  ["bnb", "BNB Chain"],
  ["optimism", "Optimism"],
  ["avalanche", "Avalanche"],
  ["sui", "Sui"],
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
        <p className="shrink-0 text-sm font-semibold text-muted">Pays out on</p>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <div ref={track} className="flex w-max items-center gap-10 pr-10">
            {row.map(([id, name], i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${id}-${i}`} src={`/networks/${id}.svg`} alt={i < NETWORKS.length ? name : ""} title={name} width={40} height={40} className="h-10 w-10 shrink-0" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
