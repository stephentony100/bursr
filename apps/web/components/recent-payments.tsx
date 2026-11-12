import { ArrowRight, Robot } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Avatar } from "@/components/agent-panel";
import type { FeedEntry } from "@/lib/agent/view";
import { chainName } from "@/lib/chains";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { formatUsd } from "@/lib/money";

// Home's transaction list: who, what for, how much, and where it stands.

const STATUS: Record<string, { label: string; tone: string }> = {
  delivered: { label: "Paid", tone: "text-ok" },
  sent: { label: "On its way", tone: "text-ledger" },
  paying: { label: "Paying", tone: "text-ledger" },
  waiting: { label: "Retrying", tone: "text-hold" },
  failed: { label: "Not paid", tone: "text-refuse" },
  refunded: { label: "Returned", tone: "text-hold" },
};

export async function recentPayments(db: PrismaClient, take = 6) {
  const rows = await db.planItem.findMany({
    where: { placement: "in", payStatus: { in: Object.keys(STATUS) } },
    orderBy: [{ sentAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    take,
  });
  return rows.map((r) => {
    let chain = "";
    try {
      chain = chainName((JSON.parse(r.payout) as { token: { chain: string } }).token.chain);
    } catch {
      /* no payout */
    }
    return { id: r.id, name: r.payeeName, forWhat: r.forWhat, chain, amountUsd: BigInt(r.amountUsd), status: r.payStatus, at: r.sentAt };
  });
}

export function RecentPayments({ rows }: { rows: Awaited<ReturnType<typeof recentPayments>> }) {
  return (
    <section data-tour="recent" aria-labelledby="recent" className="rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id="recent" className="font-bold">
          Recent payments
        </h2>
        <Link href="/records" className="text-sm font-semibold text-ledger">
          See all
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No payments yet.</p>
      ) : (
        <ul className="mt-1 pb-2">
          {rows.map((r) => {
            const s = STATUS[r.status];
            return (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    {r.forWhat}
                    {r.chain && ` · ${r.chain}`}
                    {r.at && ` · ${r.at.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num font-semibold">{formatUsd(r.amountUsd)}</p>
                  <p className={`text-xs font-semibold ${s.tone}`}>{s.label}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The agent's latest word, in one line, with a way into the full story. */
export function AgentLine({ entry }: { entry: FeedEntry | undefined }) {
  return (
    <Link href="/agent" data-tour="agent" className="flex items-center gap-3 rounded-2xl border border-line bg-card px-5 py-3.5 hover:bg-paper">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ledger-soft text-ledger">
        <Robot size={18} weight="bold" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-muted">Your agent</span>
        <span className="block truncate text-sm">{entry?.message ?? "Watching for payments due."}</span>
      </span>
      <ArrowRight size={16} weight="bold" aria-hidden className="shrink-0 text-muted" />
    </Link>
  );
}
