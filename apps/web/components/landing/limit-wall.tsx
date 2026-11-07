"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useSeen } from "./motion";
import { CropMarks, Stamp } from "./paper";

// A $5,000 payment tries to get past the $900-a-payment limit and bounces off
// the wall. It plays once when scrolled into view; the button replays it.
// The message is the one the app shows (README "Try it", step 9).

type Phase = "idle" | "moving" | "hit" | "blocked";

export function LimitWall() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, 0.5);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);

  const play = () => {
    timers.current.forEach(clearTimeout);
    if (reduced) {
      setPhase("blocked");
      return;
    }
    setPhase("idle");
    timers.current = [
      window.setTimeout(() => setPhase("moving"), 60),
      window.setTimeout(() => setPhase("hit"), 1100),
      window.setTimeout(() => setPhase("blocked"), 1550),
    ];
  };

  useEffect(() => {
    if (!seen) return;
    const t = window.setTimeout(play, 0);
    return () => clearTimeout(t);
    // play once on first sight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const atWall = phase === "moving" || phase === "hit";
  const bounced = phase === "blocked";

  return (
    <div ref={ref} className="relative rounded-2xl border border-cream/10 bg-night-2/70 p-5 sm:p-8">
      <CropMarks />
      <div className="relative h-48 overflow-hidden rounded-xl bg-night/60 [--wall:74cqw] [container-type:inline-size] sm:[--wall:66cqw]">
        {/* The limit: a red line with a hatched no-go zone behind it */}
        <div className="absolute inset-y-0 left-[var(--wall)] right-0 bg-[repeating-linear-gradient(135deg,rgb(200_50_43/0.22)_0_10px,transparent_10px_20px)]" />
        <div className={`absolute inset-y-0 left-[var(--wall)] w-[3px] bg-stamp shadow-[0_0_20px_rgba(200,50,43,0.9)] ${phase === "hit" ? "shake" : ""}`} />
        <p className="eyebrow absolute bottom-3 right-3 text-right text-[0.58rem] text-[#ff9d95] sm:text-[0.62rem]">
          Your limit
          <br />
          $900 a payment
        </p>

        <div
          className={`absolute left-4 top-1/2 w-40 transition-transform sm:w-52 ${phase === "moving" ? "duration-1000 ease-in" : "duration-500 ease-out"}`}
          style={{ transform: `translateY(-50%) translateX(${atWall ? "calc(var(--wall) - 100% - 16px)" : bounced ? "calc(var(--wall) - 100% - 64px)" : "0px"})` }}
        >
          <div className={`relative rounded-xl bg-cream p-3 text-ink sm:p-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.8)] ${phase === "hit" ? "shake" : ""}`}>
            <p className="eyebrow text-[0.6rem] text-muted">Payment request</p>
            <p className="num mt-1 text-xl font-medium sm:text-2xl">$5,000.00</p>
            <p className="mt-1 font-mono text-[0.65rem] text-muted">to Eko Fresh Foods · USDT on Tron</p>
            {bounced && (
              <span className="stamp-in absolute -right-4 -top-7 inline-block" style={{ ["--tilt" as string]: "10deg" }}>
                <Stamp verdict="block" note="Over your limit" tilt={0} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className={`max-w-xl text-sm transition-opacity duration-500 ${bounced ? "opacity-100" : "opacity-0"}`}>
          <span className="font-semibold text-[#ffb4ae]">🛡 Blocked by your spending rules.</span>{" "}
          <span className="text-cream/75">This is more than your $900.00 limit for a single payment.</span>
        </p>
        <button type="button" onClick={play} className="eyebrow shrink-0 rounded-lg border border-cream/20 px-4 py-2.5 text-cream transition-colors hover:border-mint hover:text-mint">
          Try to sneak $5,000 past it ↻
        </button>
      </div>
    </div>
  );
}
