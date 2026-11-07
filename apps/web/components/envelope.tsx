import { formatUsd } from "@/lib/money";

/**
 * The week's spending as a bar filling toward the weekly limit, over a ledger ruler.
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
      <div className="relative mt-5">
        <div
          className="h-4 overflow-hidden rounded-full bg-paper ring-1 ring-line"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          aria-label="Share of the weekly limit used"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${pct >= 100 ? "bg-refuse" : pct >= 80 ? "bg-hold" : "bg-ledger"}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {/* a ledger ruler under the bar: a tick every 10%, taller at the halfway mark */}
        <div className="mt-1.5 flex justify-between" aria-hidden>
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className={`w-px ${i % 5 === 0 ? "h-3 bg-ink/50" : "h-1.5 bg-ink/25"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}
