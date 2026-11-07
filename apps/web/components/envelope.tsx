import type { ReactNode } from "react";
import { GuillocheBand } from "@/components/landing/paper";
import { formatUsd } from "@/lib/money";

/**
 * This week at a glance, as a cheque-book counterfoil: what is left to spend
 * on the left, the wallet's facts on the perforated stub. The limit itself is
 * enforced by the agent account, not by this page.
 */
export function Envelope({ spent, cap, resetsAt, facts }: { spent: bigint; cap: bigint; resetsAt: Date | null; facts: { label: string; value: ReactNode }[] }) {
  const pct = cap > 0n ? Number((spent * 1000n) / cap) / 10 : 100;
  const left = cap > spent ? cap - spent : 0n;
  return (
    <section aria-label="This week's spending" className="relative grid overflow-hidden rounded-xl border border-line bg-card md:grid-cols-[minmax(0,1fr)_18rem]">
      <GuillocheBand className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full" opacity={0.22} />
      <div className="relative px-6 pb-6 pt-12">
        <p className="field-label text-muted">Left to spend this week</p>
        <p className="num mt-1 whitespace-nowrap text-5xl font-semibold tracking-tight">{formatUsd(left)}</p>
        <div
          className="mt-5 h-2.5 overflow-hidden rounded-[2px] bg-paper-2"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          aria-label="Share of the weekly limit used"
        >
          <div
            className={`h-full transition-[width] duration-700 ease-[var(--ease-out)] ${pct >= 100 ? "bg-refuse" : pct >= 80 ? "bg-hold" : "bg-ledger"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="mt-2 text-sm tabular-nums text-muted">
          <span className="num">{formatUsd(spent)}</span> of <span className="num">{formatUsd(cap)}</span> used
          {resetsAt && <>, refills {resetsAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</>}
        </p>
      </div>
      <dl className="relative border-t-2 border-dotted border-ink/30 bg-paper-2 px-6 py-4 md:border-l-2 md:border-t-0">
        {facts.map((f) => (
          <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-dotted border-ink/25 py-3 last:border-b-0">
            <dt className="text-sm text-muted">{f.label}</dt>
            <dd className="whitespace-nowrap text-right text-lg font-bold [font-stretch:110%]">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
