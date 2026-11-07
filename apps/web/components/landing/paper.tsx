import type { CSSProperties, ReactNode } from "react";
import { usd, type Verdict, type WeekInvoice } from "./week-data";

// Paper pieces for the home page, drawn as exact geometry: security
// linework, crossings, rubber stamps, invoices. Flat colour only.

export const VERDICT: Record<Verdict, { word: string; color: string }> = {
  ready: { word: "Ready", color: "#1d6a60" },
  hold: { word: "Hold", color: "#95580a" },
  block: { word: "Void", color: "#b3261e" },
};

/**
 * Guilloche: the interlaced security lines printed across a cheque.
 * Phase-shifted sine waves under a slow envelope, computed once.
 */
function guilloche(w: number, h: number, lines: number, period: number) {
  const paths: string[] = [];
  for (let k = 0; k < lines; k++) {
    const phase = (k / lines) * Math.PI * 2;
    let d = "";
    for (let x = 0; x <= w; x += 3) {
      const env = 0.55 + 0.45 * Math.cos((2 * Math.PI * x) / (period * 4.3) + phase / 3);
      const y = h / 2 + (h / 2 - 1) * env * Math.sin((2 * Math.PI * x) / period + phase);
      d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
    }
    paths.push(d);
  }
  return paths;
}
const BAND = guilloche(600, 40, 7, 46);

export function GuillocheBand({ className = "", color = "#2f6f6a", opacity = 0.35 }: { className?: string; color?: string; opacity?: number }) {
  return (
    <svg viewBox="0 0 600 40" preserveAspectRatio="none" className={className} aria-hidden>
      {BAND.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/** A rosette, the round security mark in a cheque's corner. */
export function Rosette({ color = "#2f6f6a", className = "" }: { color?: string; className?: string }) {
  return (
    <svg viewBox="-50 -50 100 100" className={className} aria-hidden>
      {Array.from({ length: 24 }, (_, k) => (
        <ellipse key={k} rx="46" ry="15" fill="none" stroke={color} strokeWidth="0.4" transform={`rotate(${k * 7.5})`} />
      ))}
    </svg>
  );
}

/**
 * A rubber stamp. `t` (0..1) drives the press when scroll animates it;
 * omit it for a stamp that is already down.
 */
export function Stamp({ verdict, word, note, t, tilt = -6, size = "md" }: { verdict: Verdict; word?: string; note?: string; t?: number; tilt?: number; size?: "sm" | "md" | "lg" }) {
  const v = VERDICT[verdict];
  const style: CSSProperties = { color: v.color, borderColor: v.color };
  if (t === undefined) style.transform = `rotate(${tilt}deg)`;
  else {
    style.opacity = t > 0 ? Math.min(1, t * 3) : 0;
    style.transform = `rotate(${tilt}deg) scale(${t > 0 ? 1 + (1 - t) * 0.5 : 1.5})`;
  }
  const pad = size === "lg" ? "px-4 py-2" : size === "sm" ? "px-1.5 py-1" : "px-2.5 py-1.5";
  const text = size === "lg" ? "text-xl" : size === "sm" ? "text-[0.55rem]" : "text-[0.72rem]";
  return (
    <span className={`inline-block rounded-[3px] border-2 text-center leading-none ${pad}`} style={style}>
      <span className={`field-label block font-extrabold ${text}`}>{word ?? v.word}</span>
      {note && <span className="mt-1 block text-[0.62rem] font-medium leading-tight">{note}</span>}
    </span>
  );
}

/** One supplier invoice on plain paper, 170 x 224 px. */
export function PaperInvoice({ inv, stamp }: { inv: WeekInvoice; stamp?: ReactNode }) {
  return (
    <div className="relative h-[224px] w-[170px] overflow-hidden rounded-[4px] border border-ink/15 bg-card p-3.5 text-ink shadow-[0_14px_30px_-18px_rgb(22_32_42/0.55)]">
      <p className="field-label whitespace-nowrap text-[0.52rem] text-muted">Invoice {inv.number}</p>
      <p className="mt-1.5 text-[1rem] font-bold leading-tight [font-stretch:105%]">{inv.supplier}</p>
      <ul className="mt-3 space-y-1 border-t border-ink/10 pt-2 text-[0.62rem] text-muted">
        {inv.lines.map((l) => (
          <li key={l.description} className="flex justify-between gap-2">
            <span className="truncate">{l.description}</span>
            <span className="num">{l.total}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 flex justify-between border-t border-ink/25 pt-2 text-[0.7rem] font-semibold">
        <span className="field-label text-[0.55rem]">Total</span>
        <span className="num">{usd(inv.totalCents)}</span>
      </p>
      {stamp && <div className="absolute bottom-4 left-0 right-0 flex justify-center">{stamp}</div>}
    </div>
  );
}

/** A red-pen ring drawn round a mistake. */
export function RingMark({ delay = 600, color = "#b3261e", className = "" }: { delay?: number; color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 80" preserveAspectRatio="none" className={`pointer-events-none absolute -inset-x-[14%] -inset-y-[16%] h-[132%] w-[128%] overflow-visible ${className}`} aria-hidden>
      <path
        d="M168 14 C 120 2, 40 4, 14 26 C -6 44, 22 72, 96 74 C 160 76, 196 58, 190 34 C 186 18, 150 8, 112 9"
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        className="draw"
        style={{ animationDelay: `${delay}ms` }}
      />
    </svg>
  );
}

/** The crossing: two parallel lines with A/C PAYEE ONLY between them. Draws itself unless `still`. */
export function Crossing({ delay = 300, still = false, className = "" }: { delay?: number; still?: boolean; className?: string }) {
  const draw = still ? "" : "draw";
  return (
    <svg viewBox="0 0 240 70" className={`pointer-events-none overflow-visible ${className}`} aria-hidden>
      <path d="M6 46 L234 6" pathLength={1} stroke="#16202a" strokeWidth="2" className={draw} style={{ animationDelay: `${delay}ms` }} />
      <path d="M6 66 L234 26" pathLength={1} stroke="#16202a" strokeWidth="2" className={draw} style={{ animationDelay: `${delay + 140}ms` }} />
      <g transform="rotate(-9.95 120 36)">
      <text
        x="120"
        y="40"
        textAnchor="middle"
        fill="#16202a"
        fontSize="11"
        fontWeight="700"
        letterSpacing="2"
        style={{ fontFamily: "var(--font-archivo)", fontStretch: "125%", opacity: still ? 1 : 0, animation: still ? undefined : `tick-in 260ms var(--ease-out) ${delay + 420}ms both` }}
      >
        A/C PAYEE ONLY
      </text>
      </g>
    </svg>
  );
}
