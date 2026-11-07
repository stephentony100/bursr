import type { CSSProperties, ReactNode } from "react";
import { usd, type Verdict, type WeekInvoice } from "./week-data";

// Paper pieces for the home page: invoice cards, rubber stamps, a red-pen
// ring and blueprint crop marks. All drawn with HTML/CSS/SVG.

export const VERDICT: Record<Verdict, { word: string; color: string }> = {
  ready: { word: "Ready", color: "#0f6b4f" },
  hold: { word: "Hold", color: "#a86a12" },
  block: { word: "Blocked", color: "#c8322b" },
};

/** Pastel paper tints, one per invoice. */
export const TINTS = ["#e4f4ea", "#fff1cf", "#ffe3dc", "#e9e9ff", "#dff0fa", "#fbe4f0"];

/** A banknote-style rosette: thin rotated ellipses, like the security print on a cheque. */
export function Rosette({ color = "#0f6b4f", className = "" }: { color?: string; className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" className={className} aria-hidden>
      {Array.from({ length: 18 }, (_, k) => (
        <ellipse key={k} rx="46" ry="13" fill="none" stroke={color} strokeWidth="0.45" transform={`rotate(${k * 10})`} />
      ))}
      <circle r="9" fill="none" stroke={color} strokeWidth="0.5" />
    </svg>
  );
}

/** A rubber stamp. `t` (0..1) drives the slam when it is animated by scroll; omit it for a static stamp. */
export function Stamp({ verdict, word, note, t, tilt = -8, size = "md" }: { verdict: Verdict; word?: string; note?: string; t?: number; tilt?: number; size?: "sm" | "md" | "lg" }) {
  const v = VERDICT[verdict];
  const style: CSSProperties = { color: v.color, borderColor: v.color };
  if (t === undefined) style.transform = `rotate(${tilt}deg)`;
  else {
    const k = t <= 0 ? 0 : t;
    style.opacity = k > 0 ? Math.min(1, k * 2.5) : 0;
    style.transform = `rotate(${tilt}deg) scale(${k > 0 ? 1 + (1 - k) * 1.3 : 2.3})`;
  }
  const pad = size === "lg" ? "px-4 py-2" : size === "sm" ? "px-1.5 py-0.5" : "px-2.5 py-1";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-[0.55rem]" : "text-[0.8rem]";
  return (
    <span className={`inline-block rounded-md border-[2.5px] bg-white/40 text-center leading-none mix-blend-multiply ${pad}`} style={style}>
      <span className={`eyebrow block font-semibold ${text}`}>{word ?? v.word}</span>
      {note && <span className="mt-1 block font-mono text-[0.6rem] leading-tight">{note}</span>}
    </span>
  );
}

/** One supplier invoice on paper, 170 × 224 px. */
export function PaperInvoice({ inv, tint, stamp }: { inv: WeekInvoice; tint: string; stamp?: ReactNode }) {
  return (
    <div
      className="grain relative h-[224px] w-[170px] overflow-hidden rounded-xl border border-black/10 p-3.5 text-ink shadow-[0_24px_50px_-20px_rgba(0,0,0,0.65)]"
      style={{ background: `linear-gradient(165deg, ${tint} 0%, #fffdf6 75%)` }}
    >
      <Rosette className="absolute -right-10 -top-10 h-32 w-32 opacity-30" />
      <p className="relative whitespace-nowrap font-mono text-[0.55rem] uppercase tracking-[0.06em] text-muted">Invoice #{inv.number}</p>
      <p className="relative mt-1 font-display text-[1.05rem] font-semibold leading-tight">{inv.supplier}</p>
      <ul className="relative mt-3 space-y-1 font-mono text-[0.6rem] text-muted">
        {inv.lines.map((l) => (
          <li key={l.description} className="flex justify-between gap-2">
            <span className="truncate">{l.description}</span>
            <span>{l.total}</span>
          </li>
        ))}
      </ul>
      <p className="relative mt-2.5 flex justify-between border-t border-dashed border-black/20 pt-2 font-mono text-[0.7rem] font-medium">
        <span>TOTAL</span>
        <span>{usd(inv.totalCents)}</span>
      </p>
      {stamp && <div className="absolute bottom-4 left-0 right-0 flex justify-center">{stamp}</div>}
    </div>
  );
}

/** A red-pen ring drawn around a word, the way you'd circle a mistake on paper. */
export function RingMark({ delay = 900, color = "#e5483f", className = "" }: { delay?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 80" preserveAspectRatio="none" className={`pointer-events-none absolute -inset-x-[7%] -inset-y-[16%] h-[132%] w-[114%] overflow-visible ${className}`} aria-hidden>
      <path
        d="M168 14 C 120 2, 40 4, 14 26 C -6 44, 22 72, 96 74 C 160 76, 196 58, 190 34 C 186 18, 150 8, 112 9"
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        className="draw"
        style={{ animationDelay: `${delay}ms`, animationDuration: "900ms" }}
      />
    </svg>
  );
}

/** Blueprint crop marks on the four corners of the parent (which must be `relative`). */
export function CropMarks({ color = "#4fd1a0" }: { color?: string }) {
  const c = "pointer-events-none absolute h-3 w-3";
  const s = { borderColor: color };
  return (
    <>
      <span aria-hidden className={`${c} -left-px -top-px border-l-2 border-t-2`} style={s} />
      <span aria-hidden className={`${c} -right-px -top-px border-r-2 border-t-2`} style={s} />
      <span aria-hidden className={`${c} -bottom-px -left-px border-b-2 border-l-2`} style={s} />
      <span aria-hidden className={`${c} -bottom-px -right-px border-b-2 border-r-2`} style={s} />
    </>
  );
}

/** A slowly turning seal with Bursar's four outcomes printed round the rim. */
export function Seal({ id, className = "", spin = true }: { id: string; className?: string; spin?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <defs>
        <path id={id} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
      </defs>
      <g className={spin ? "spin-slow" : ""} style={{ transformOrigin: "100px 100px" }}>
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 4" />
        <text fill="currentColor" fontFamily="var(--font-mono)" fontSize="12" textLength="458" lengthAdjust="spacing">
          <textPath href={`#${id}`}>CHECKED • HELD FOR YOU • APPROVED • PAID •</textPath>
        </text>
      </g>
      <path d="M78 102l15 15 30-34" fill="none" stroke="#4fd1a0" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
