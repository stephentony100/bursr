"use client";

import { ChatCircleDots, Eye, EyeSlash, PaperPlaneTilt, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

// Home's first card: the money in the Bursr wallet, big, with the three things
// owners do most right beside it. The amount can be hidden (kept per device).

const KEY = "bursr:hide-balance";
const EVENT = "bursr:hide-balance";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function readHidden() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function Amount({ value, hidden }: { value: string; hidden: boolean }) {
  if (hidden) return <span aria-label="Hidden">$ ••••••</span>;
  const cents = value.match(/(\.\d+)$/)?.[1] ?? "";
  return (
    <>
      {value.slice(0, value.length - cents.length)}
      <span className="text-[0.55em] text-white/70">{cents}</span>
    </>
  );
}

export function BalanceCard({
  balance,
  left,
  used,
  cap,
  pct,
  refills,
  status,
  tone,
}: {
  balance: string | null;
  left: string;
  used: string;
  cap: string;
  pct: number;
  refills: string | null;
  status: string;
  tone: "on" | "paused" | "manual";
}) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const toggle = () => {
    try {
      localStorage.setItem(KEY, hidden ? "0" : "1");
    } catch {
      /* private mode: it just won't be remembered */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  const dot = tone === "on" ? "bg-ok-bright animate-pulse" : tone === "paused" ? "bg-refuse" : "bg-hold-bright";

  return (
    <section aria-label="Your Bursr wallet" className="overflow-hidden rounded-[var(--radius-card)] bg-night text-white">
      <div className="relative p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-ledger/40 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-white/70">
            Wallet balance
            <button onClick={toggle} aria-label={hidden ? "Show balance" : "Hide balance"} className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/10">
              {hidden ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            </button>
          </p>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
            <span aria-hidden className={`h-2 w-2 rounded-full ${dot}`} />
            {status}
          </span>
        </div>
        <p className="num relative mt-2 font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight sm:text-5xl">
          {balance === null ? "…" : <Amount value={balance} hidden={hidden} />}
        </p>

        <div className="relative mt-5">
          <div className="flex items-baseline justify-between text-xs text-white/70">
            <span>
              <span className="num font-semibold text-white">{hidden ? "••••" : left}</span> left this week
            </span>
            <span className="num hidden sm:inline">
              {hidden ? "••••" : used} of {cap}
              {refills && ` · refills ${refills}`}
            </span>
            <span className="num sm:hidden">of {cap}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Weekly limit used">
            <div className={`h-full rounded-full ${pct >= 100 ? "bg-refuse" : pct >= 80 ? "bg-hold-bright" : "bg-white"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-white/10">
        {[
          { href: "/add-money", label: "Add money", Icon: Plus },
          { href: "/people#pay-once", label: "Pay someone", Icon: PaperPlaneTilt },
          { href: "/agent", label: "Ask agent", Icon: ChatCircleDots },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 py-4 text-xs font-semibold text-white/90 hover:bg-white/5 sm:flex-row sm:justify-center sm:gap-2 sm:text-sm">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ledger">
              <Icon size={18} weight="bold" aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
