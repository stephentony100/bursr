"use client";

import { useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

/**
 * Reveals its text line by line with Hear.ai's settings: each line from
 * opacity 0, blur 16px and 14px down, over 1s on power2.out, 0.15s apart.
 * `onScroll` waits until the block is 80% down the screen.
 */
export function Reveal({ children, className = "", as: Tag = "div", onScroll = false }: { children: ReactNode; className?: string; as?: "div" | "h1" | "h2" | "p"; onScroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      const split = SplitText.create(ref.current, { type: "lines" });
      gsap.fromTo(
        split.lines,
        { opacity: 0, filter: "blur(16px)", y: 14 },
        { opacity: 1, filter: "blur(0px)", y: 0, duration: 1, ease: "power2.out", stagger: 0.15, scrollTrigger: onScroll ? { trigger: ref.current, start: "top 80%", once: true } : undefined },
      );
      return () => split.revert();
    },
    { scope: ref },
  );
  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
