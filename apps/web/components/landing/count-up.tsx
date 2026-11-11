"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

/** A figure like "$3.05bn", "74%" or "$126k" that counts up when it scrolls into view. */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = value.match(/^([^\d]*)([\d.]+)(.*)$/);
  useGSAP(
    () => {
      if (!ref.current || !m || prefersReducedMotion()) return;
      const [, pre, num, post] = m;
      const decimals = num.includes(".") ? num.split(".")[1].length : 0;
      const o = { v: 0 };
      gsap.to(o, {
        v: Number(num),
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
        onUpdate: () => {
          if (ref.current) ref.current.textContent = `${pre}${o.v.toFixed(decimals)}${post}`;
        },
      });
    },
    { scope: ref },
  );
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
