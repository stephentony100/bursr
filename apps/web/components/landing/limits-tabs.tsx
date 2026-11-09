"use client";

import { CheckCircle, HandCoins, Pause, UserCheck, type Icon } from "@phosphor-icons/react";
import { useRef, useState, type ReactNode } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "./gsap";
import { LimitWall } from "./limit-wall";

// "Your limits" as auto-advancing tabs, built the way Stax.ai builds theirs:
// the open item's text grows from height 0 to auto over 0.5s on a "snappy"
// custom ease while a hairline under it fills over 5s (linear), then the next
// item opens; the cycle starts when the section scrolls into view.

interface Rule {
  icon: Icon;
  label: string;
  value: string;
  body: string;
  visual: ReactNode;
}

function Meter() {
  return (
    <div className="rounded-xl border border-ink/15 bg-card p-6">
      <p className="text-sm text-muted">Left to spend this week</p>
      <p className="num mt-1 text-4xl font-semibold sm:text-5xl">$1,838.71</p>
      <div className="mt-5 h-2.5 rounded-[2px] bg-paper-2">
        <div className="h-full w-[26%] rounded-[2px] bg-ledger" />
      </div>
      <p className="mt-2 text-sm text-muted">
        <span className="num">$661.29</span> of <span className="num">$2,500.00</span> used, refills Saturday
      </p>
    </div>
  );
}

function Refusal({ title, line }: { title: string; line: string }) {
  return (
    <div className="rounded-xl border border-ink/15 bg-card p-6">
      <p className="text-sm text-muted">The wallet answered</p>
      <p className="mt-3 text-lg font-semibold text-refuse">{title}</p>
      <p className="mt-2 text-ink/75">{line}</p>
    </div>
  );
}

const RULES: Rule[] = [
  { icon: HandCoins, label: "Weekly limit", value: "$2,500.00", body: "The most that can leave your Bursar wallet in a week. It refills on payday.", visual: <Meter /> },
  { icon: CheckCircle, label: "Per payment", value: "$900.00", body: "Anything bigger is refused by the wallet itself, even if the AI asks for it.", visual: <LimitWall /> },
  {
    icon: UserCheck,
    label: "Only people you added",
    value: "6 people",
    body: "A wallet that isn't on your list can't be paid. Only you can add someone, and new payout details wait 48 hours.",
    visual: <Refusal title="Blocked by your spending rules." line="This wallet isn't one of the people you pay. Only you can add someone new." />,
  },
  {
    icon: Pause,
    label: "Emergency stop",
    value: "One button",
    body: "Pause all payments. Nothing goes out until you turn them back on.",
    visual: <Refusal title="Blocked by your spending rules." line="Payments are paused. Turn them back on from Spending rules when you're ready." />,
  },
];

export function LimitsTabs() {
  const root = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useGSAP(
    () => {
      const dds = gsap.utils.toArray<HTMLElement>(".js-dd", root.current);
      const lines = gsap.utils.toArray<HTMLElement>(".js-line", root.current);
      const reduce = prefersReducedMotion();
      let index = 0;
      let timer: gsap.core.Tween | null = null;

      gsap.set(dds, { height: 0 });
      gsap.set(dds[0], { height: "auto" });
      gsap.set(lines, { scaleX: 0, transformOrigin: "left center" });

      const open = (next: number) => {
        const prev = index;
        index = next;
        setCurrent(next);
        timer?.kill();
        if (prev !== next) {
          gsap.to(dds[prev], { height: 0, duration: 0.5, ease: "snappy" });
          gsap.to(lines[prev], { scaleX: 0, duration: 0.5, ease: "snappy" });
        }
        gsap.to(dds[next], { height: "auto", duration: 0.5, ease: "snappy" });
        if (reduce) return;
        timer = gsap.fromTo(lines[next], { scaleX: 0 }, { scaleX: 1, duration: 5, ease: "none", onComplete: () => open(gsap.utils.wrap(0, dds.length, index + 1)) });
      };

      // Start the 5-second cycle only while the section is on screen.
      let started = false;
      ScrollTrigger.create({
        trigger: root.current,
        start: "top 70%",
        end: "bottom 20%",
        onToggle: (self) => {
          if (self.isActive && !started) {
            started = true;
            open(0);
          } else if (self.isActive) timer?.resume();
          else timer?.pause();
        },
      });

      const buttons = gsap.utils.toArray<HTMLButtonElement>(".js-dt", root.current);
      const handlers = buttons.map((b, i) => {
        const h = () => {
          started = true;
          open(i);
        };
        b.addEventListener("click", h);
        return h;
      });
      return () => buttons.forEach((b, i) => b.removeEventListener("click", handlers[i]));
    },
    { scope: root },
  );

  return (
    <div ref={root} className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-24">
        {RULES.map((r, i) => (
          <div key={r.label} className={i === current ? "block" : "hidden"} aria-hidden={i !== current}>
            {r.visual}
          </div>
        ))}
      </div>
      <ul className="border-t border-ink/15">
        {RULES.map((r, i) => {
          const Glyph = r.icon;
          const on = i === current;
          return (
            <li key={r.label} className="relative border-b border-ink/15">
              <button type="button" aria-expanded={on} className="js-dt flex w-full items-center gap-4 py-5 text-left">
                <Glyph size={20} weight={on ? "fill" : "regular"} className={on ? "text-ledger" : "text-muted"} aria-hidden />
                <span className={`flex-1 text-lg font-bold ${on ? "text-ink" : "text-ink/60"}`}>{r.label}</span>
                <span className={`text-sm ${r.value.startsWith("$") ? "num" : "font-semibold"} ${on ? "text-ledger" : "text-muted"}`}>{r.value}</span>
              </button>
              <div className="js-dd overflow-hidden">
                <p className="max-w-md pb-6 pl-9 leading-relaxed text-ink/75">{r.body}</p>
              </div>
              <span aria-hidden className="js-line absolute -bottom-px left-0 h-[2px] w-full bg-ledger" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
