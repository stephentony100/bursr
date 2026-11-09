import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  HandWaving,
  PaperPlaneTilt,
  Robot,
  UserCircle,
  Wallet,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { approveItemAction, runPaydayNowAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import type { FeedEntry, NeedsYou, Upcoming } from "@/lib/agent/view";
import { formatUsd } from "@/lib/money";
import { chainName } from "@/lib/tokens";

// The agent on screen: what it's doing (feed), what it needs from the owner,
// and what it will pay next. Server components; the page refreshes itself.

const dayWords = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function feedLook(e: FeedEntry) {
  if (e.by === "owner") return { Icon: UserCircle, tone: "text-muted", bg: "bg-paper-2" };
  switch (e.kind) {
    case "payment_delivered":
      return { Icon: CheckCircle, tone: "text-ledger", bg: "bg-ledger-soft" };
    case "payment_sent":
    case "payment_started":
      return { Icon: PaperPlaneTilt, tone: "text-ledger", bg: "bg-ledger-soft" };
    case "payment_waiting":
      return { Icon: Clock, tone: "text-hold", bg: "bg-hold-soft" };
    case "payment_failed":
    case "agent_blocked":
      return { Icon: WarningCircle, tone: "text-refuse", bg: "bg-refuse-soft" };
    case "needs_owner":
    case "needs_money":
      return { Icon: HandWaving, tone: "text-hold", bg: "bg-hold-soft" };
    case "money_in":
      return { Icon: Wallet, tone: "text-ledger", bg: "bg-ledger-soft" };
    default:
      return { Icon: Robot, tone: "text-ink", bg: "bg-paper-2" };
  }
}

export function AgentStatus({ autopilot, frozen, nextPayday }: { autopilot: boolean; frozen: boolean; nextPayday: string }) {
  const state = frozen
    ? { dot: "bg-refuse", text: "Paused. The agent won't pay anyone until you turn payments back on." }
    : autopilot
      ? { dot: "bg-ledger animate-pulse", text: `Working. It pays routine payments on their day and asks you about anything unusual. Next payday: ${dayWords(nextPayday)}.` }
      : { dot: "bg-hold", text: "Autopilot is off. The agent prepares payments and waits for your OK on each list." };
  return (
    <section aria-label="Your agent" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-night px-5 py-4 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10">
          <Robot size={22} weight="bold" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            Your Bursar agent <span aria-hidden className={`h-2 w-2 rounded-full ${state.dot}`} />
          </p>
          <p className="text-sm text-white/75">{state.text}</p>
        </div>
      </div>
      {!frozen && <ActionForm action={runPaydayNowAction} submit="Run payday now" tone="quiet" className="[&_[role=status]]:!text-white/85 [&_button]:bg-white [&_button]:text-ink" />}
    </section>
  );
}

export function NeedsYouList({ items }: { items: NeedsYou[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="needs-you" className="rounded-xl border border-hold/40 bg-hold-soft/50 p-5">
      <h2 id="needs-you" className="flex items-center gap-2 text-base font-bold">
        <HandWaving size={18} weight="bold" aria-hidden className="text-hold" /> Needs you ({items.length})
      </h2>
      <ul className="mt-3 divide-y divide-hold/20">
        {items.map((n) => (
          <li key={n.itemId} className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {n.payeeName} · <span className="num">{formatUsd(n.amountUsd)}</span> <span className="text-muted">({n.forWhat})</span>
              </p>
              <p className="text-sm text-muted">{n.reason}</p>
            </div>
            {n.kind === "approve" && (
              <ActionForm action={approveItemAction} submit="OK, pay it">
                <input type="hidden" name="itemId" value={n.itemId} />
              </ActionForm>
            )}
            {n.kind === "funds" && (
              <Link href="/add-money" className="rounded-md bg-ledger px-3 py-2 text-sm font-semibold text-card hover:bg-indigo">
                Add money
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AgentFeed({ entries }: { entries: FeedEntry[] }) {
  return (
    <section aria-labelledby="agent-feed" className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="agent-feed" className="flex items-center gap-2 text-base font-bold">
          <ArrowsClockwise size={16} weight="bold" aria-hidden className="text-ledger" /> What your agent is doing
        </h2>
        <Link href="/records" className="text-sm text-indigo underline">
          All records
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Nothing yet. The agent checks every minute and writes here what it does.</p>
      ) : (
        <ol className="divide-y divide-line" aria-live="polite">
          {entries.map((e) => {
            const { Icon, tone, bg } = feedLook(e);
            return (
              <li key={e.id} className="flex gap-3 px-5 py-3">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${bg} ${tone}`}>
                  <Icon size={15} weight="bold" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="sr-only">{e.by === "agent" ? "Agent: " : "You: "}</span>
                    {e.message}
                  </p>
                  <p className="text-xs text-muted">
                    {e.by === "agent" ? "Agent" : "You"} ·{" "}
                    <time dateTime={e.at.toISOString()}>{e.at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function ComingUp({ items }: { items: Upcoming[] }) {
  return (
    <section aria-labelledby="coming-up" className="rounded-xl border border-line bg-card p-5">
      <h2 id="coming-up" className="text-base font-bold">
        Coming up
      </h2>
      <p className="mt-1 text-xs text-muted">The agent pays these on their day.</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing in the next two weeks.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.slice(0, 8).map((u, i) => (
            <li key={`${u.payeeName}-${u.dueOn}-${i}`} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.payeeName}</p>
                <p className="text-xs text-muted">
                  {dayWords(u.dueOn)} · {u.forWhat}
                  {u.payout && ` · ${u.payout.token.symbol} on ${chainName(u.payout.token.chain)}`}
                </p>
              </div>
              <span className="num shrink-0">{formatUsd(u.amountUsd)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
