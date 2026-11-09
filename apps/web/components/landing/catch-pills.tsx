"use client";

import { Bank, CopySimple, TextAa, TrendUp, type Icon } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "./motion";
import { RingMark, Stamp } from "./paper";
import type { Verdict } from "./week-data";

// "What Bursar checks": four tall slips; the open one widens to show the
// catch from the sample week. They take turns until you pick one.

export interface Catch {
  title: string;
  icon: Icon;
  verdict: Verdict;
  line: string;
  show: ReactNode;
}

const TINT: Record<Verdict, string> = { ready: "bg-ledger-soft", hold: "bg-hold-soft", block: "bg-refuse-soft" };

function Plate({ label, children, warn = false }: { label: string; children: ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-[6px] border bg-card px-5 py-4 ${warn ? "border-refuse/50" : "border-ink/15"}`}>
      <p className={`field-label ${warn ? "text-refuse" : "text-muted"}`}>{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function catches(usualAddress: string, newAddress: string): Catch[] {
  return [
    {
      title: "Look-alike names",
      icon: TextAa,
      verdict: "block",
      line: "A zero where an O should be, easy to miss at the end of a long day. Bursar compares every name with the people you pay.",
      show: (
        <div className="space-y-3">
          <Plate label="On your list">
            <p className="text-3xl font-bold [font-stretch:108%]">Eko Fresh Foods</p>
          </Plate>
          <Plate label="On this invoice" warn>
            <p className="text-3xl font-bold [font-stretch:108%]">
              Ek
              <span className="relative inline-block">
                0
                <RingMark delay={200} />
              </span>{" "}
              Fresh Foods
            </p>
          </Plate>
        </div>
      ),
    },
    {
      title: "The same bill twice",
      icon: CopySimple,
      verdict: "hold",
      line: "Same supplier, same number, same amount, sent again on Wednesday. Paid once is enough.",
      show: (
        <div className="relative h-60 max-w-[22rem]">
          {[
            { day: "Arrived Monday", rot: -4, x: 0, y: 0, extra: null },
            { day: "Arrived Wednesday", rot: 3, x: 96, y: 74, extra: "Sent again" },
          ].map((s) => (
            <div
              key={s.day}
              className="absolute w-60 rounded-[4px] border border-ink/15 bg-card p-4 shadow-[0_14px_30px_-18px_rgb(22_32_42/0.55)]"
              style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)` }}
            >
              <p className="field-label text-muted">Invoice MPF-0412</p>
              <p className="mt-1 text-lg font-bold [font-stretch:105%]">Mama Put Farms Ltd</p>
              <p className="mt-3 flex justify-between text-xs">
                <span className="text-muted">{s.day}</span>
                <span className="num">$118.00</span>
              </p>
              {s.extra && <p className="field-label mt-2 text-refuse">{s.extra}</p>}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Changed bank details",
      icon: Bank,
      verdict: "block",
      line: "“Pay our new account, today” is the oldest trick there is. Only you can change where someone gets paid, and new details wait 48 hours.",
      show: (
        <div className="space-y-3">
          <Plate label="Where Eko Fresh Foods gets paid, set by you">
            <p className="num break-all">{usualAddress}</p>
          </Plate>
          <Plate label="This invoice says pay" warn>
            <p className="num break-all text-refuse">{newAddress}</p>
            <p className="mt-2 text-sm italic text-muted">“Our bank details have changed. Pay today or your supply will be stopped.”</p>
          </Plate>
        </div>
      ),
    },
    {
      title: "Prices creeping up",
      icon: TrendUp,
      verdict: "hold",
      line: "Bursar knows the prices you agreed and holds anything more than 5% over. Six crates at $23.40 is $32.40 more than you agreed.",
      show: (
        <Plate label="Tomatoes (crate), invoice MPF-0419">
          <div className="mt-3 space-y-4 text-sm">
            <div>
              <p className="flex justify-between">
                <span className="text-muted">Agreed</span>
                <span className="num">$18.00</span>
              </p>
              <div className="mt-1.5 h-3 rounded-[2px] bg-ledger" style={{ width: `${(1800 / 2340) * 100}%` }} />
            </div>
            <div>
              <p className="flex items-center justify-between">
                <span className="text-muted">
                  Billed <span className="ml-1 rounded-[3px] bg-hold px-1.5 py-0.5 text-[0.68rem] font-semibold text-card">30% more</span>
                </span>
                <span className="num text-hold">$23.40</span>
              </p>
              <div className="mt-1.5 h-3 w-full rounded-[2px] bg-hold" />
            </div>
          </div>
        </Plate>
      ),
    },
  ];
}

export function CatchPills({ usualAddress, newAddress }: { usualAddress: string; newAddress: string }) {
  const list = catches(usualAddress, newAddress);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (picked || reduced) return;
    const t = setInterval(() => setActive((a) => (a + 1) % list.length), 6500);
    return () => clearInterval(t);
  }, [picked, reduced, list.length]);

  const pick = (i: number) => {
    setActive(i);
    setPicked(true);
  };

  return (
    <div className="flex flex-col gap-3 lg:h-[480px] lg:flex-row">
      {list.map((c, i) => {
        const on = i === active;
        const Glyph = c.icon;
        return (
          <div
            key={c.title}
            onMouseEnter={() => pick(i)}
            className={`relative overflow-hidden rounded-[12px] border border-ink/10 transition-[flex-grow] duration-500 ease-[var(--ease-in-out)] lg:min-w-[96px] ${TINT[c.verdict]} ${on ? "lg:flex-[7]" : "lg:flex-[1]"}`}
          >
            <button
              type="button"
              onClick={() => pick(i)}
              onFocus={() => pick(i)}
              aria-expanded={on}
              className={`relative flex w-full items-center justify-between gap-4 px-6 py-5 text-left lg:absolute lg:inset-0 lg:flex-col lg:items-center lg:justify-between lg:py-8 lg:transition-opacity ${on ? "lg:pointer-events-none lg:opacity-0 lg:duration-0" : "lg:opacity-100 lg:delay-200 lg:duration-300"}`}
            >
              <span className="text-xl font-bold [font-stretch:110%] lg:rotate-180 lg:[writing-mode:vertical-rl]">{c.title}</span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-ink/15 bg-card">
                <Glyph size={22} weight="bold" aria-hidden />
              </span>
            </button>
            <div
              className={`relative grid gap-8 px-6 pb-7 transition-opacity lg:absolute lg:inset-0 lg:min-w-[680px] lg:grid-cols-[1fr_1.15fr] lg:items-center lg:p-10 ${on ? "opacity-100 delay-300 duration-300" : "pointer-events-none hidden opacity-0 duration-0 lg:block"}`}
            >
              <div>
                <h3 className="display hidden text-5xl leading-[0.95] lg:block">{c.title}</h3>
                <p className="max-w-sm leading-relaxed text-ink/80 lg:mt-5">{c.line}</p>
                <div className="mt-6">
                  <Stamp verdict={c.verdict} note={c.verdict === "block" ? "Not paid" : "Waits for you"} tilt={-5} />
                </div>
              </div>
              <div>{c.show}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
