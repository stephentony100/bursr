import {
  ArrowRight,
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
import { approveItemAction, cancelPaymentAction, retryPaymentAction, runPaydayNowAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import type { FeedEntry, NeedsYou, Upcoming } from "@/lib/agent/view";
import { formatUsd } from "@/lib/money";
import { chainName } from "@/lib/tokens";

// The agent on screen: what it needs from the owner, what it's doing, and
// what it pays next. Rows in the fintech pattern: icon, name, one short line,
// amount on the right. Server components; the page refreshes itself.

export const dayWords = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ledger-soft text-sm font-bold text-ledger ${className}`}>
      {initials(name) || "?"}
    </span>
  );
}

function feedLook(e: FeedEntry) {
  if (e.by === "owner") return { Icon: UserCircle, tone: "text-muted", bg: "bg-paper-2" };
  switch (e.kind) {
    case "payment_delivered":
    case "home_done":
      return { Icon: CheckCircle, tone: "text-ok", bg: "bg-ok-soft" };
    case "payment_sent":
    case "payment_started":
    case "payment_exchanging":
    case "payment_exchanged":
    case "payment_sending":
      return { Icon: PaperPlaneTilt, tone: "text-ledger", bg: "bg-ledger-soft" };
    case "payment_waiting":
      return { Icon: Clock, tone: "text-hold", bg: "bg-hold-soft" };
    case "payment_failed":
    case "agent_blocked":
    case "account_refused":
    case "home_failed":
      return { Icon: WarningCircle, tone: "text-refuse", bg: "bg-refuse-soft" };
    case "needs_owner":
    case "needs_money":
      return { Icon: HandWaving, tone: "text-hold", bg: "bg-hold-soft" };
    case "money_in":
      return { Icon: Wallet, tone: "text-ok", bg: "bg-ok-soft" };
    default:
      return { Icon: Robot, tone: "text-ink", bg: "bg-paper-2" };
  }
}

/** The agent's state in one line (Agent page). */
export function AgentStatus({ autopilot, frozen, nextPayday }: { autopilot: boolean; frozen: boolean; nextPayday: string }) {
  const state = frozen
    ? { dot: "bg-refuse", text: "Paused" }
    : autopilot
      ? { dot: "bg-ok animate-pulse", text: `Working · next payday ${dayWords(nextPayday)}` }
      : { dot: "bg-hold", text: "Waiting for your OK on each list" };
  return (
    <section aria-label="Your agent" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-4">
      <p className="flex items-center gap-3 font-semibold">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-ledger-soft text-ledger">
          <Robot size={20} weight="bold" aria-hidden />
        </span>
        <span>
          Your Bursr agent
          <span className="flex items-center gap-1.5 text-sm font-normal text-muted">
            <span aria-hidden className={`h-2 w-2 rounded-full ${state.dot}`} /> {state.text}
          </span>
        </span>
      </p>
      {!frozen && <ActionForm action={runPaydayNowAction} submit="Run payday now" tone="quiet" />}
    </section>
  );
}

export function NeedsYouList({ items, limit }: { items: NeedsYou[]; limit?: number }) {
  if (items.length === 0) return null;
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <section data-tour="needs-you" aria-labelledby="needs-you" className="rounded-2xl border border-hold/30 bg-card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id="needs-you" className="flex items-center gap-2 font-bold">
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-hold px-1.5 text-xs text-white">{items.length}</span>
          Needs you
        </h2>
        {limit && items.length > limit && (
          <Link href="/agent" className="text-sm font-semibold text-ledger">
            See all
          </Link>
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {shown.map((n) => (
          <li key={n.itemId} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
            <Avatar name={n.payeeName} className="bg-hold-soft text-hold" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 font-semibold">
                <span className="truncate">{n.payeeName}</span>
                {n.kind !== "invite" && <span className="num">{formatUsd(n.amountUsd)}</span>}
              </p>
              <p className="line-clamp-2 text-sm text-muted">{n.reason}</p>
            </div>
            {n.kind === "approve" && (
              <ActionForm action={approveItemAction} submit="Approve" inline>
                <input type="hidden" name="itemId" value={n.itemId} />
              </ActionForm>
            )}
            {n.kind === "invite" && (
              <Link href="/people" className="rounded-xl bg-ledger px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo">
                Review
              </Link>
            )}
            {n.kind === "funds" && (
              <Link href="/add-money" className="rounded-xl bg-ledger px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo">
                Add money
              </Link>
            )}
            {n.kind === "failed" && (
              <div className="flex w-full flex-wrap items-end gap-2 sm:pl-14">
                <ActionForm action={retryPaymentAction} submit="Try again" inline>
                  <input type="hidden" name="itemId" value={n.itemId} />
                </ActionForm>
                <ActionForm action={retryPaymentAction} submit="Try this amount" tone="quiet" className="flex flex-wrap items-end gap-2 [&>div]:mt-0">
                  <input type="hidden" name="itemId" value={n.itemId} />
                  <label className="text-xs text-muted">
                    <span className="sr-only">New amount</span>
                    <span className="flex items-center rounded-xl border border-line bg-card">
                      <span className="pl-3 text-muted">$</span>
                      <input name="amount" required inputMode="decimal" placeholder="New amount" className="num w-28 bg-transparent px-2 py-2.5 text-sm text-ink outline-none" />
                    </span>
                  </label>
                </ActionForm>
                {n.payeeId && (
                  <Link href={`/people/${n.payeeId}#where`} className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-paper">
                    Change where they get paid
                  </Link>
                )}
                <ActionForm action={cancelPaymentAction} submit="Cancel it" tone="quiet" inline>
                  <input type="hidden" name="itemId" value={n.itemId} />
                </ActionForm>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AgentFeed({ entries, title = "Activity", seeAll }: { entries: FeedEntry[]; title?: string; seeAll?: string }) {
  return (
    <section aria-labelledby="agent-feed" className="rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 id="agent-feed" className="font-bold">
          {title}
        </h2>
        {seeAll && (
          <Link href={seeAll} className="text-sm font-semibold text-ledger">
            See all
          </Link>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Nothing yet. Your agent checks every minute.</p>
      ) : (
        <ol className="mt-1 pb-2" aria-live="polite">
          {entries.map((e) => {
            const { Icon, tone, bg } = feedLook(e);
            return (
              <li key={e.id} className="flex gap-3 px-5 py-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${bg} ${tone}`}>
                  <Icon size={17} weight="bold" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="sr-only">{e.by === "agent" ? "Agent: " : "You: "}</span>
                    {e.message}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
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
    <section aria-labelledby="coming-up" className="rounded-2xl border border-line bg-card p-5">
      <h2 id="coming-up" className="font-bold">
        Coming up
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing in the next two weeks.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.slice(0, 6).map((u, i) => (
            <li key={`${u.payeeName}-${u.dueOn}-${i}`} className="flex items-center gap-3 text-sm">
              <Avatar name={u.payeeName} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{u.payeeName}</p>
                <p className="truncate text-xs text-muted">
                  {dayWords(u.dueOn)} · {u.forWhat}
                  {u.payout && ` · ${chainName(u.payout.token.chain)}`}
                </p>
              </div>
              <span className="num shrink-0 font-semibold">{formatUsd(u.amountUsd)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href="/payments" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-ledger">
        All payments <ArrowRight size={14} weight="bold" aria-hidden />
      </Link>
    </section>
  );
}
