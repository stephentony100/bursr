"use client";

import { useEffect, useRef, useState } from "react";
import { ease, lerp, seg, useReducedMotion, useScrollProgress } from "./motion";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { PaperInvoice, Stamp } from "./paper";
import { NETWORKS, WEEK_INVOICES, WEEK_PAYMENTS, WEEK_TOTAL_CENTS, usd } from "./week-data";

// The home page's centrepiece: one pinned screen that plays a week at the
// sample restaurant as you scroll. Invoices drop into a pile, fan out, get
// checked and stamped, the four bad ones fall into "Held for you", the clean
// ones join staff pay on one list, the owner approves once, and each payment
// flies to the network its payee chose. Everything is a function of scroll
// progress q (0..1), so scrolling back plays it in reverse.

const CW = 170;
const CH = 224;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  W: number;
  H: number;
  /** Card scale. */
  cs: number;
  compact: boolean;
  pile: { x: number; y: number };
  arc: { cx: number; cy: number; R: number; step: number };
  receipt: { x: number; y: number; w: number; top: number; row: number };
  tray: Box;
  held: { x: number; y: number; dx: number; dy: number; s: number };
  chips: Box[];
  counter: { x: number; y: number };
}

const WIDE: Layout = {
  W: 920,
  H: 680,
  cs: 1,
  compact: false,
  pile: { x: 460, y: 330 },
  arc: { cx: 460, cy: 1180, R: 890, step: 8.6 },
  receipt: { x: 20, y: 40, w: 390, top: 92, row: 58 },
  tray: { x: 440, y: 420, w: 256, h: 240 },
  held: { x: 502, y: 572, dx: 42, dy: -4, s: 0.56 },
  chips: [0, 1, 2, 3].map((k) => ({ x: 722, y: 150 + k * 92, w: 196, h: 78 })),
  counter: { x: 722, y: 48 },
};

const NARROW: Layout = {
  W: 400,
  H: 660,
  cs: 0.66,
  compact: true,
  pile: { x: 200, y: 290 },
  arc: { cx: 200, cy: 1000, R: 720, step: 5.6 },
  receipt: { x: 8, y: 6, w: 384, top: 58, row: 40 },
  tray: { x: 8, y: 436, w: 186, h: 214 },
  held: { x: 52, y: 568, dx: 32, dy: -3, s: 0.4 },
  chips: [
    { x: 204, y: 476, w: 92, h: 82 },
    { x: 300, y: 476, w: 92, h: 82 },
    { x: 204, y: 566, w: 92, h: 82 },
    { x: 300, y: 566, w: 92, h: 82 },
  ],
  counter: { x: 204, y: 436 },
};

// When each beat happens, as a share of the scroll.
const T = {
  drop: (i: number) => [0.03 + i * 0.028, 0.1 + i * 0.028] as const,
  fan: [0.22, 0.32] as const,
  scan: [0.33, 0.48] as const,
  tray: [0.5, 0.56] as const,
  receipt: [0.5, 0.56] as const,
  sort: (k: number) => [0.53 + k * 0.012, 0.61 + k * 0.012] as const,
  rows: [0.6, 0.615, 0.63, 0.645, 0.66, 0.675],
  total: 0.69,
  press: 0.705,
  approved: [0.71, 0.73] as const,
  chips: [0.74, 0.78] as const,
  ticket: (j: number) => [0.79 + j * 0.026, 0.85 + j * 0.026] as const,
};

const STEPS = [
  {
    n: "01",
    when: "Mon – Thu",
    title: "Invoices come in.",
    body: "Snap a photo of each invoice and upload it. Bursar reads it privately: who it's from, what you bought, how much, and where they want the money.",
  },
  {
    n: "02",
    when: "As they arrive",
    title: "Every one is checked.",
    body: "Is it really your supplier? Have you paid it already? Did their bank details change? Are the prices what you agreed? Anything odd is held, with the reason in one plain sentence.",
  },
  {
    n: "03",
    when: "Friday",
    title: "One list. One OK.",
    body: "Staff pay and the clean invoices go on one list, with every fee shown. You read it, then approve everyone at once.",
  },
  {
    n: "04",
    when: "Minutes later",
    title: "Everyone is paid.",
    body: "6 payments, $661.29, each in digital dollars on the network the payee chose. The 4 problem invoices wait for you, each with its reason.",
  },
];
const STEP_AT = [0, 0.2, 0.5, 0.76];

const READY = WEEK_INVOICES.flatMap((v, i) => (v.verdict === "ready" ? [i] : []));
const HELD = WEEK_INVOICES.flatMap((v, i) => (v.verdict === "ready" ? [] : [i]));
const JITTER = [
  { x: -30, y: 12, r: -11 },
  { x: 24, y: -8, r: 8 },
  { x: -6, y: 4, r: -3 },
  { x: 30, y: -14, r: 13 },
  { x: -24, y: 8, r: -8 },
  { x: 10, y: -2, r: 4 },
];
const TILT = [-8, 6, -5, 9, -7, 4];

function arcPoint(i: number, L: Layout) {
  const th = (i - (WEEK_INVOICES.length - 1) / 2) * L.arc.step;
  const rad = (th * Math.PI) / 180;
  return { x: L.arc.cx + L.arc.R * Math.sin(rad), y: L.arc.cy - L.arc.R * Math.cos(rad), r: th };
}

function cardAt(i: number, q: number, L: Layout) {
  const j = JITTER[i];
  const pile = { x: L.pile.x + j.x * L.cs * 1.6, y: L.pile.y + j.y * L.cs, r: j.r };
  const arc = arcPoint(i, L);
  const [d0, d1] = T.drop(i);
  const td = ease(seg(q, d0, d1));
  let x = pile.x;
  let y = lerp(-CH, pile.y, td);
  let r = lerp(pile.r * 2 + (i % 2 ? 24 : -24), pile.r, td);
  let s = L.cs;
  let o = q > d0 ? 1 : 0;
  const tf = ease(seg(q, ...T.fan));
  x = lerp(x, arc.x, tf);
  y = lerp(y, arc.y, tf);
  r = lerp(r, arc.r, tf);
  if (WEEK_INVOICES[i].verdict === "ready") {
    const g = READY.indexOf(i);
    const ts = ease(seg(q, ...T.sort(g)));
    const rowY = L.receipt.y + L.receipt.top + g * L.receipt.row + L.receipt.row / 2;
    x = lerp(x, L.receipt.x + L.receipt.w * 0.4, ts);
    y = lerp(y, rowY, ts);
    r = lerp(r, 0, ts);
    s = lerp(s, L.cs * 0.2, ts);
    o *= 1 - seg(ts, 0.7, 1);
  } else {
    const k = HELD.indexOf(i);
    const ts = ease(seg(q, ...T.sort(READY.length + k)));
    x = lerp(x, L.held.x + k * L.held.dx, ts);
    y = lerp(y, L.held.y + k * L.held.dy, ts);
    r = lerp(r, -10 + k * 6.5, ts);
    s = lerp(s, L.held.s, ts);
  }
  return { x, y, r, s, o };
}

/** The stamp lands the moment the scanner passes the card. */
function stampAt(i: number, q: number, L: Layout) {
  const [a, b] = T.scan;
  const at = a + (b - a) * ((arcPoint(i, L).x + 60) / (L.W + 120));
  return seg(q, at, at + 0.012);
}

/** Reduced motion: jump between the end of each step instead of animating. */
const snap = (p: number) => (p < 0.2 ? 0.2 : p < 0.5 ? 0.49 : p < 0.76 ? 0.74 : 1);

export function WeekScene() {
  const ref = useRef<HTMLElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const p = useScrollProgress(ref);
  const reduced = useReducedMotion();
  const q = reduced ? snap(p) : p;
  const step = STEP_AT.findLastIndex((s) => q >= s);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const L = box.w > 0 && box.w < 620 ? NARROW : WIDE;
  const scale = box.w ? Math.min(box.w / L.W, box.h / L.H) : 0;

  return (
    <section ref={ref} id="how" aria-label="A week with Bursar" className="relative border-y border-ink/10 bg-paper-2 text-ink" style={{ height: "620vh" }}>
      <ol className="sr-only">
        {STEPS.map((s) => (
          <li key={s.n}>
            {s.title} {s.body}
          </li>
        ))}
      </ol>
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden lg:flex-row">
        {/* Caption: left column on large screens, top block on phones */}
        <div className="relative z-10 flex shrink-0 gap-6 px-5 pt-6 lg:w-[440px] lg:items-center lg:pl-12 lg:pt-0 xl:w-[480px]">
          <div aria-hidden className="relative min-h-[150px] flex-1 lg:min-h-[320px]">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`absolute inset-x-0 top-0 transition-[opacity,transform] duration-300 ease-[var(--ease-out)] lg:top-1/2 lg:-translate-y-1/2 ${i === step ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0 lg:translate-y-[-46%]"}`}
              >
                <h2 className="display text-3xl leading-[0.95] sm:text-4xl xl:text-5xl">{s.title}</h2>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-ink/75 lg:mt-5 lg:text-base">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stage */}
        <div ref={wrap} className="relative mx-3 mb-20 mt-3 min-h-0 flex-1 lg:my-20 lg:mr-12">
          {scale > 0 && (
            <div aria-hidden className="absolute left-1/2 top-1/2" style={{ width: L.W, height: L.H, transform: `translate(-50%, -50%) scale(${scale})` }}>
              <Stage q={q} L={L} />
            </div>
          )}
        </div>

        <WeekRuler q={q} />
      </div>
    </section>
  );
}

function Stage({ q, L }: { q: number; L: Layout }) {
  const R = L.receipt;
  const tb = seg(q, ...T.scan);
  const beamX = lerp(-60, L.W + 60, tb);
  const tTray = ease(seg(q, ...T.tray));
  const tReceipt = ease(seg(q, ...T.receipt));
  const tChips = ease(seg(q, ...T.chips));
  const tSign = ease(seg(q, ...T.approved));
  const arrived = WEEK_PAYMENTS.map((_, j) => q >= T.ticket(j)[1]);
  const paidCents = WEEK_PAYMENTS.reduce((s, pmt, j) => s + (arrived[j] ? pmt.cents : 0), 0);
  const pressed = q >= T.press;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Held for you */}
      <div
        className="absolute rounded-[6px] border-2 border-dashed border-refuse/45 bg-refuse-soft/60"
        style={{ left: L.tray.x, top: L.tray.y, width: L.tray.w, height: L.tray.h, opacity: tTray, transform: `translateY(${(1 - tTray) * 24}px)` }}
      >
        <p className={`field-label absolute left-3 top-3 text-refuse ${L.compact ? "text-[0.6rem]" : ""}`}>Held for you: {HELD.length}</p>
        {!L.compact && <p className="absolute left-3 right-3 top-8 text-[0.72rem] leading-snug text-ink/70">Each with its reason. Nothing here is paid until you decide.</p>}
      </div>

      {/* This week's cheques, as a counterfoil list */}
      <div className="absolute" style={{ left: R.x, top: R.y, width: R.w, opacity: tReceipt, transform: `translateY(${(1 - tReceipt) * 30}px)` }}>
        <div className="relative rounded-t-[6px] border border-b-2 border-ink/15 border-b-ink/35 border-dotted bg-card px-4 pb-5 text-ink shadow-[0_24px_50px_-30px_rgb(22_32_42/0.6)] [border-left-style:solid] [border-right-style:solid] [border-top-style:solid]">
          <div style={{ height: R.top }} className="flex flex-col justify-center border-b-2 border-ink">
            <p className={`field-label text-muted ${L.compact ? "text-[0.55rem]" : ""}`}>This week&apos;s cheques, Friday</p>
            <p className={`font-bold [font-stretch:110%] ${L.compact ? "text-base" : "text-xl"}`}>Bukka Corner Restaurant</p>
          </div>
          {WEEK_PAYMENTS.map((pmt, j) => {
            const on = q >= T.rows[j];
            return (
              <div
                key={pmt.who}
                style={{ height: R.row }}
                className={`flex items-center justify-between gap-3 border-b border-dotted border-ink/25 transition-[opacity,transform] duration-300 ${on ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`}
              >
                <div className="min-w-0">
                  <p className={`truncate font-semibold ${L.compact ? "text-[0.72rem]" : "text-sm"}`}>{pmt.who}</p>
                  <p className={`truncate text-muted ${L.compact ? "text-[0.56rem]" : "text-[0.7rem]"}`}>
                    {pmt.what}, {pmt.token} on {pmt.network}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`num ${L.compact ? "text-[0.72rem]" : "text-sm"}`}>{usd(pmt.cents)}</p>
                  <p className={`field-label flex items-center justify-end gap-1 text-[0.52rem] text-ledger transition-opacity ${arrived[j] ? "opacity-100" : "opacity-0"}`}>
                    <Check size={9} weight="bold" /> Paid
                  </p>
                </div>
              </div>
            );
          })}
          <div className={`flex justify-between py-2.5 font-bold transition-opacity duration-300 ${q >= T.total ? "opacity-100" : "opacity-0"} ${L.compact ? "text-sm" : "text-base"}`}>
            <span>Total</span>
            <span className="num">{usd(WEEK_TOTAL_CENTS)}</span>
          </div>
          <div className={`relative flex items-end justify-between gap-3 transition-opacity duration-300 ${q >= T.total ? "opacity-100" : "opacity-0"}`}>
            <div
              className={`inline-flex items-center gap-1.5 rounded-[5px] font-semibold transition-colors duration-200 ${L.compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"} ${pressed ? "bg-ink text-card" : "bg-ledger text-card"}`}
            >
              {pressed ? (
                <>
                  <Check size={14} weight="bold" /> Approved
                </>
              ) : (
                "Approve and pay everyone"
              )}
            </div>
            <div className="min-w-0 text-right">
              <p className={`hand border-b border-ink/40 px-1 ${L.compact ? "text-[0.8rem] leading-[2]" : "text-base leading-[2.2]"}`} style={{ clipPath: `inset(0 ${(1 - tSign) * 100}% 0 0)` }}>
                Bukka Corner
              </p>
              <p className={`field-label mt-1 text-muted ${L.compact ? "text-[0.48rem]" : "text-[0.55rem]"}`}>Signed once</p>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices */}
      {WEEK_INVOICES.map((inv, i) => {
        const c = cardAt(i, q, L);
        return (
          <div
            key={`${inv.number}-${i}`}
            className="absolute left-0 top-0"
            style={{ transform: `translate(${c.x - CW / 2}px, ${c.y - CH / 2}px) rotate(${c.r}deg) scale(${c.s})`, opacity: c.o, zIndex: 10 + i }}
          >
            <PaperInvoice inv={inv} stamp={<Stamp verdict={inv.verdict} note={inv.note} t={stampAt(i, q, L)} tilt={TILT[i]} />} />
          </div>
        );
      })}

      {/* The checking pass: a ruler line moving across */}
      <div className="absolute top-0 z-30 h-full" style={{ left: beamX, opacity: tb > 0 && tb < 1 ? 1 : 0 }}>
        <div className="absolute -left-16 top-0 h-full w-16 bg-ledger/[0.07]" />
        <div className="absolute left-0 top-0 h-full w-[2px] bg-ledger" />
        <span className="field-label absolute left-2.5 top-2 whitespace-nowrap rounded-[3px] bg-ledger px-1.5 py-0.5 text-card">Checking</span>
      </div>

      {/* Paid so far, and one clearing slot per network */}
      <div className="absolute" style={{ left: L.counter.x, top: L.counter.y, opacity: tChips }}>
        <p className={`field-label text-muted ${L.compact ? "text-[0.55rem]" : ""}`}>Paid so far</p>
        <p className={`num font-semibold text-ledger ${L.compact ? "text-lg leading-tight" : "mt-1 text-[2.6rem] leading-none"}`}>{usd(paidCents)}</p>
      </div>
      {NETWORKS.map((n, k) => {
        const ch = L.chips[k];
        const mine = WEEK_PAYMENTS.flatMap((pmt, j) => (pmt.network === n && arrived[j] ? [pmt.cents] : []));
        return (
          <div
            key={n}
            className={`absolute rounded-[6px] border bg-card transition-colors duration-300 ${mine.length ? "border-ledger" : "border-ink/15"} ${L.compact ? "p-2.5" : "px-4 py-3"}`}
            style={{ left: ch.x, top: ch.y, width: ch.w, height: ch.h, opacity: tChips, transform: `translateX(${(1 - tChips) * 40}px)` }}
          >
            <p className={`font-bold [font-stretch:110%] ${L.compact ? "text-sm" : "text-lg"}`}>{n}</p>
            <p className={`mt-1 tabular-nums ${mine.length ? "text-ledger" : "text-muted"} ${L.compact ? "text-[0.66rem] leading-snug" : "text-sm"}`}>
              {mine.length ? (
                <>
                  {mine.length} paid{L.compact ? <br /> : ", "}
                  <span className="num">{usd(mine.reduce((a, b) => a + b, 0))}</span>
                </>
              ) : (
                "Waiting"
              )}
            </p>
          </div>
        );
      })}

      {/* Payments in flight: small cheques on their way to clear */}
      {WEEK_PAYMENTS.map((pmt, j) => {
        const t = seg(q, ...T.ticket(j));
        if (t <= 0 || t >= 1) return null;
        const e = ease(t);
        const ch = L.chips[NETWORKS.indexOf(pmt.network)];
        const x0 = R.x + R.w - (L.compact ? 50 : 70);
        const y0 = R.y + R.top + j * R.row + R.row / 2;
        const x1 = ch.x + ch.w / 2;
        const y1 = ch.y + ch.h / 2;
        const cx = (x0 + x1) / 2;
        const cy = Math.min(y0, y1) - 90;
        const x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * cx + e * e * x1;
        const y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * cy + e * e * y1;
        return (
          <div
            key={pmt.who}
            className="absolute left-0 top-0 z-40 flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-ink/25 bg-card px-2.5 py-1.5 text-[0.7rem] font-semibold text-ink shadow-[0_8px_18px_-10px_rgb(22_32_42/0.6)]"
            style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${L.compact ? 0.85 : 1})`, opacity: t > 0.85 ? (1 - t) / 0.15 : 1 }}
          >
            {pmt.who.split(" ")[0]} <span className="num font-normal">{usd(pmt.cents)}</span>
            <ArrowRight size={11} weight="bold" /> {pmt.network}
          </div>
        );
      })}
    </div>
  );
}

/** Monday to Friday along the bottom; the marker walks to payday as you scroll. */
function WeekRuler({ q }: { q: number }) {
  const pos = q < 0.5 ? (q / 0.5) * 0.75 : 0.75 + seg(q, 0.5, 0.56) * 0.25;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div aria-hidden className="absolute inset-x-5 bottom-4 lg:inset-x-12 lg:bottom-6">
      <div className="relative h-3 border-b border-ink/40">
        {days.map((d, i) => (
          <span key={d} className="absolute bottom-0 h-3 w-px bg-ink/40" style={{ left: `${(i / 4) * 100}%` }} />
        ))}
        <span className="absolute -bottom-1 h-5 w-[3px] -translate-x-1/2 bg-ledger" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="relative mt-1.5 h-4">
        {days.map((d, i) => (
          <span
            key={d}
            className={`field-label absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full ${i === 4 && pos >= 1 ? "text-ledger" : pos >= i / 4 - 0.001 ? "text-ink" : "text-ink/40"}`}
            style={{ left: `${(i / 4) * 100}%` }}
          >
            {i === 4 ? (
              <>
                Fri<span className="hidden sm:inline">, payday</span>
              </>
            ) : (
              d
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
