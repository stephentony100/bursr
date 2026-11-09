"use client";

import { ArrowsClockwise, Prohibit } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion, useSeen } from "./motion";
import { Badge } from "@/components/ui/badge";

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
      <div className="relative h-52 overflow-hidden rounded-xl border border-line bg-paper [--bounce:36px] [--wall:66cqw] [container-type:inline-size] sm:[--bounce:64px]">
        {/* Past the line: the zone no payment may enter */}
        <div className="absolute inset-y-0 left-[var(--wall)] right-0 bg-refuse-soft" />
        <div className={`absolute inset-y-0 left-[var(--wall)] w-[3px] bg-refuse ${phase === "hit" ? "shake" : ""}`} />
        <p className="absolute bottom-3 left-[calc(var(--wall)+10px)] right-2 text-xs font-medium leading-snug text-refuse">
          <span className="whitespace-nowrap">Your limit</span>
          <br />
          <span className="num">$900.00</span>
          <br />
          <span className="whitespace-nowrap">a payment</span>
        </p>

        <div
          className={`absolute left-3 top-1/2 w-40 transition-transform sm:left-4 sm:w-60 ${phase === "moving" ? "duration-700 ease-[var(--ease-in-out)]" : "duration-500 ease-[var(--ease-out)]"}`}
          style={{ transform: `translateY(-50%) translateX(${atWall ? "calc(var(--wall) - 100% - 16px)" : bounced ? "calc(var(--wall) - 100% - var(--bounce))" : "0px"})` }}
        >
          <div className={`relative ${phase === "hit" ? "shake" : ""}`}>
            <div className="rounded-lg border border-line bg-card p-3 shadow-sm sm:p-4">
              <p className="text-xs font-medium text-muted">Payment request</p>
              <p className="mt-1 truncate text-sm font-semibold">Eko Fresh Foods</p>
              <p className="num mt-2 text-lg font-semibold sm:text-xl">$5,000.00</p>
              <p className="mt-1 text-xs text-muted">USDT on Tron</p>
            </div>
            {bounced && (
              <span className="absolute -right-3 -top-3">
                <Badge tone="block">Refused</Badge>
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
          className="press inline-flex shrink-0 items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-semibold hover:border-ink/40"
        >
          <ArrowsClockwise size={16} weight="bold" aria-hidden /> Try to sneak $5,000 past it
        </button>
      </div>
    </div>
  );
}
