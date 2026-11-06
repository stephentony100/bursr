import { formatUsd } from "@/lib/money";

/**
 * The week's spending as a cash envelope filling toward the weekly limit.
 * The limit itself is enforced by the agent account, not by this page.
 */
export function Envelope({ spent, cap, resetsAt }: { spent: bigint; cap: bigint; resetsAt: Date | null }) {
  const pct = cap > 0n ? Number((spent * 1000n) / cap) / 10 : 100;
  const left = cap > spent ? cap - spent : 0n;
  return (
    <section aria-label="This week's spending" className="rounded-xl border border-line bg-card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Left to spend this week</p>
          <p className="num font-display text-5xl font-semibold tracking-tight">{formatUsd(left)}</p>
        </div>
        <p className="num text-sm text-muted">
          {formatUsd(spent)} of {formatUsd(cap)} used
          {resetsAt && <> · refills {resetsAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</>}
        </p>
      </div>
      <div
        className="relative mt-5 h-14 overflow-hidden rounded-md border-2 border-ink/80 bg-paper"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-label="Share of the weekly limit used"
      >
        {/* envelope flap */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden>
          <polyline points="0,0 50,13 100,0" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <div
          className={`h-full transition-[width] duration-700 ease-out ${pct >= 100 ? "bg-refuse/80" : pct >= 80 ? "bg-hold/80" : "bg-ledger/85"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </section>
  );
}
