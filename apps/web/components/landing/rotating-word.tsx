"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

/** One word that changes in place: each slides up and out as the next slides in. */
export function RotatingWord({ words, className = "" }: { words: string[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-word]", ref.current);
      if (prefersReducedMotion() || items.length < 2) return;
      gsap.set(items, { yPercent: 110, autoAlpha: 0 });
      gsap.set(items[0], { yPercent: 0, autoAlpha: 1 });
      const tl = gsap.timeline({ repeat: -1 });
      items.forEach((el, i) => {
        const next = items[(i + 1) % items.length];
        tl.to(el, { yPercent: -110, autoAlpha: 0, duration: 0.55, ease: "power3.in" }, "+=2.2").fromTo(
          next,
          { yPercent: 110, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.65, ease: "power3.out" },
          "<0.15",
        );
      });
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className={`relative inline-grid overflow-hidden align-bottom ${className}`}>
      {words.map((w, i) => (
        <span key={w} data-word aria-hidden={i > 0} className={`col-start-1 row-start-1 whitespace-nowrap ${i > 0 ? "invisible" : ""}`}>
          {w}
        </span>
      ))}
    </span>
  );
}
