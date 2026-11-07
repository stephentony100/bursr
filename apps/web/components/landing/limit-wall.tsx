"use client";

import { ArrowsClockwise, Prohibit } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useSeen } from "./motion";
import { Crossing, GuillocheBand, Stamp } from "./paper";

// A $5,000 cheque tries to get past the $900-a-payment limit and bounces.
// It plays once when scrolled into view; the button replays it. The message
// is the one the app shows (README "Try it", step 9).

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
      window.setTimeout(() => setPhase("hit"), 900),
      window.setTimeout(() => setPhase("blocked"), 1300),
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
    <div ref={ref}>
      <div className="relative h-52 overflow-hidden rounded-[12px] border border-ink/15 bg-card [--bounce:36px] [--wall:66cqw] [container-type:inline-size] sm:[--bounce:64px]">
        {/* Past the line: the zone no payment may enter */}
        <div className="absolute inset-y-0 left-[var(--wall)] right-0 bg-refuse-soft" />
        <div className={`absolute inset-y-0 left-[var(--wall)] w-[3px] bg-refuse ${phase === "hit" ? "shake" : ""}`} />
        <p className="field-label absolute bottom-3 left-[calc(var(--wall)+10px)] right-2 leading-snug text-refuse">
          <span className="whitespace-nowrap">Your limit</span>
          <br />
          <span className="num normal-case">$900.00</span>
          <br />
          <span className="whitespace-nowrap">a payment</span>
        </p>

        <div
          className={`absolute left-3 top-1/2 w-40 transition-transform sm:left-4 sm:w-60 ${phase === "moving" ? "duration-700 ease-[var(--ease-in-out)]" : "duration-500 ease-[var(--ease-out)]"}`}
          style={{ transform: `translateY(-50%) translateX(${atWall ? "calc(var(--wall) - 100% - 16px)" : bounced ? "calc(var(--wall) - 100% - var(--bounce))" : "0px"})` }}
        >
          <div className={`relative ${phase === "hit" ? "shake" : ""}`}>
            <div className="relative overflow-hidden rounded-[4px] border border-ink/25 bg-card px-3 pb-2 pt-3 sm:px-4">
              <GuillocheBand className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full" opacity={0.3} />
              <p className="field-label relative text-muted">Pay</p>
              <p className="hand relative truncate border-b border-ink/30 text-sm leading-[2]">Eko Fresh Foods</p>
              <p className="num relative mt-2 inline-block rounded-[3px] border-2 border-ink px-2 py-0.5 text-base font-semibold sm:text-lg">$5,000.00</p>
              <p className="num relative mt-2 whitespace-nowrap border-t border-ink/15 pt-1 text-[0.56rem] tracking-[0.08em] text-ink/60 sm:tracking-[0.16em]">000519 5000 00 TRON</p>
              <Crossing still className="absolute right-1 top-2 w-[46%]" />
            </div>
            {bounced && (
              <span className="stamp-in absolute -right-4 -top-6 inline-block" style={{ ["--tilt" as string]: "9deg" }}>
                <Stamp verdict="block" word="Bounced" note="Over your limit" tilt={0} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className={`flex max-w-xl items-start gap-2 text-sm transition-opacity duration-300 ${bounced ? "opacity-100" : "opacity-0"}`}>
          <Prohibit size={18} weight="bold" className="mt-0.5 shrink-0 text-refuse" aria-hidden />
          <span>
            <span className="font-semibold text-refuse">Blocked by your spending rules.</span> This is more than your $900.00 limit for a single payment.
          </span>
        </p>
        <button
          type="button"
          onClick={play}
          className="press inline-flex shrink-0 items-center gap-2 rounded-[6px] border border-ink/30 bg-card px-4 py-2.5 text-sm font-semibold hover:border-ink"
        >
          <ArrowsClockwise size={16} weight="bold" aria-hidden /> Try to sneak $5,000 past it
        </button>
      </div>
    </div>
  );
}
