"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "./motion";
import { RingMark, Rosette, Stamp } from "./paper";
import type { Verdict } from "./week-data";

// "What Bursar catches": four tall pills; the open one widens to show the
// catch from the sample week. They take turns until you pick one.

interface Catch {
  title: string;
  glyph: string;
  tint: string;
  verdict: Verdict;
  line: string;
  show: ReactNode;
}

function Plate({ label, children, warn = false }: { label: string; children: ReactNode; warn?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white/85 px-5 py-4 shadow-sm ${warn ? "ring-2 ring-stamp/40" : "ring-1 ring-black/5"}`}>
      <p className={`eyebrow text-[0.62rem] ${warn ? "text-stamp" : "text-muted"}`}>{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function catches(usualAddress: string, newAddress: string): Catch[] {
  return [
    {
      title: "Look-alike names",
      glyph: "0≠O",
      tint: "#e6e2ff",
      verdict: "block",
      line: "A zero where an O should be. Easy to miss at the end of a long day. Bursar compares every name with the people you pay.",
      show: (
        <div className="space-y-3">
          <Plate label="On your list">
            <p className="font-display text-3xl font-semibold tracking-tight">Eko Fresh Foods</p>
          </Plate>
          <Plate label="On this invoice" warn>
            <p className="font-display text-3xl font-semibold tracking-tight">
              Ek
              <span className="relative inline-block">
                0
                <RingMark delay={250} />
              </span>{" "}
              Fresh Foods
            </p>
          </Plate>
        </div>
      ),
    },
    {
      title: "The same bill twice",
      glyph: "×2",
      tint: "#fff0c2",
      verdict: "hold",
      line: "Same supplier, same number, same amount, sent again on Wednesday. Paid once is enough.",
      show: (
        <div className="relative h-60 max-w-[22rem]">
          {[
            { day: "Arrived Monday", rot: -5, x: 0, y: 0, extra: null },
            { day: "Arrived Wednesday", rot: 4, x: 96, y: 74, extra: "SENT AGAIN" },
          ].map((s) => (
            <div
              key={s.day}
              className="absolute w-60 rounded-xl border border-black/10 bg-[#fffdf6] p-4 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]"
              style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)` }}
            >
              <p className="eyebrow text-[0.6rem] text-muted">Invoice #MPF-0412</p>
              <p className="mt-1 font-display text-lg font-semibold">Mama Put Farms Ltd</p>
              <p className="mt-3 flex justify-between font-mono text-xs">
                <span className="text-muted">{s.day}</span>
                <span>$118.00</span>
              </p>
              {s.extra && <p className="eyebrow mt-2 text-[0.65rem] font-semibold text-stamp">{s.extra}</p>}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Changed bank details",
      glyph: "NEW",
      tint: "#ffe0d6",
      verdict: "block",
      line: "“Pay our new account, today” is the oldest trick there is. Only you can change where someone gets paid, and new details wait 48 hours.",
      show: (
        <div className="space-y-3">
          <Plate label="Where Eko Fresh Foods gets paid · set by you">
            <p className="break-all font-mono text-sm">{usualAddress}</p>
          </Plate>
          <Plate label="This invoice says pay" warn>
            <p className="break-all font-mono text-sm text-stamp">{newAddress}</p>
            <p className="mt-2 text-sm italic text-muted">“Our bank details have changed. Pay today or your supply will be stopped.”</p>
          </Plate>
        </div>
      ),
    },
    {
      title: "Prices creeping up",
      glyph: "+30%",
      tint: "#d8f1e4",
      verdict: "hold",
      line: "Bursar knows the prices you agreed and holds anything more than 5% over. Six crates at $23.40 is $32.40 more than you agreed.",
      show: (
        <Plate label="Tomatoes (crate) · invoice #MPF-0419">
          <div className="mt-2 space-y-3 font-mono text-sm">
            <div>
              <p className="flex justify-between">
                <span className="text-muted">Agreed</span>
                <span>$18.00</span>
              </p>
              <div className="mt-1 h-3 rounded-full bg-ledger" style={{ width: `${(1800 / 2340) * 100}%` }} />
            </div>
            <div>
              <p className="flex items-center justify-between">
                <span className="text-muted">
                  Billed <span className="ml-1 rounded bg-stamp px-1.5 py-0.5 text-[0.65rem] text-white">+30%</span>
                </span>
                <span className="text-stamp">$23.40</span>
              </p>
              <div className="mt-1 h-3 w-full rounded-full bg-[#e1a23a]" />
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
    <div className="flex flex-col gap-3 lg:h-[500px] lg:flex-row">
      {list.map((c, i) => {
        const on = i === active;
        return (
          <div
            key={c.title}
            onMouseEnter={() => pick(i)}
            className={`relative overflow-hidden rounded-[2rem] border border-black/10 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.5)] transition-[flex-grow] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:min-w-[104px] ${on ? "lg:flex-[7]" : "lg:flex-[1]"}`}
            style={{ background: `linear-gradient(160deg, ${c.tint}, #fffaf0 80%)` }}
          >
            <Rosette color="#1b2430" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 opacity-[0.12]" />
            <button
              type="button"
              onClick={() => pick(i)}
              onFocus={() => pick(i)}
              aria-expanded={on}
              className={`relative flex w-full items-center justify-between gap-4 px-6 py-5 text-left lg:absolute lg:inset-0 lg:flex-col lg:items-center lg:justify-between lg:py-8 lg:transition-opacity ${on ? "lg:pointer-events-none lg:opacity-0 lg:duration-0" : "lg:opacity-100 lg:delay-300 lg:duration-500"}`}
            >
              <span className="font-display text-xl font-semibold lg:rotate-180 lg:[writing-mode:vertical-rl]">{c.title}</span>
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/80 font-mono text-xs font-semibold shadow-sm">{c.glyph}</span>
            </button>
            <div
              className={`relative grid gap-8 px-6 pb-7 transition-opacity lg:absolute lg:inset-0 lg:min-w-[680px] lg:grid-cols-[1fr_1.15fr] lg:items-center lg:p-10 ${on ? "opacity-100 delay-[350ms] duration-500" : "pointer-events-none hidden opacity-0 duration-0 lg:block"}`}
            >
              <div>
                <p className="eyebrow hidden text-muted lg:block">
                  {String(i + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
                </p>
                <h3 className="mt-3 hidden font-display text-5xl font-semibold leading-[0.95] tracking-tight lg:block">{c.title}</h3>
                <p className="max-w-sm leading-relaxed text-ink/75 lg:mt-4">{c.line}</p>
                <div className="mt-6">
                  <Stamp verdict={c.verdict} note={c.verdict === "block" ? "Not paid" : "Waits for you"} tilt={-6} />
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
