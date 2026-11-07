"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useSeen } from "./motion";

/** A published figure that counts up once when it scrolls into view. Display only. */
export function CountUp({ to, decimals = 0, prefix = "", suffix = "" }: { to: number; decimals?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useSeen(ref, 0.6);
  const reduced = useReducedMotion();
  const [k, setK] = useState(0);

  useEffect(() => {
    if (!seen) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / 1400);
      setK(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, reduced]);

  const shown = seen ? (to * k).toFixed(decimals) : (0).toFixed(decimals);
  return (
    <span ref={ref}>
      <span aria-hidden>
        {prefix}
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {to.toFixed(decimals)}
        {suffix}
      </span>
    </span>
  );
}
