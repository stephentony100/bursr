import { ArrowRight, Lock } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { loadSample, runPaydayNowAction } from "@/app/actions";
import { ComingUp, dayWords, NeedsYouList } from "@/components/agent-panel";
import { AgentLine, RecentPayments, recentPayments } from "@/components/recent-payments";
import { BalanceCard } from "@/components/balance-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm } from "@/components/forms";
import { agentFeed, comingUp, needsYou, nextPayday } from "@/lib/agent/view";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { readEnv } from "@/lib/env";
import { listInvoices } from "@/lib/invoices";
import { formatUsd, rescale } from "@/lib/money";
import { getLatestPlan } from "@/lib/plans";
import { onboardingState, STEP_TITLES } from "@/lib/onboarding";
import { getOwner, guardPage, appDb } from "@/lib/session";
import { getBusiness, listPayees } from "@/lib/store";
import { friendlyError } from "@/lib/errors";

const STEPS = [
  { title: "Send invoices", body: "A photo or pasted text." },
  { title: "Bursr checks them", body: "Fakes, double bills and overcharges stopped." },
  { title: "Your agent pays", body: "On time, inside your limits." },
];

export default async function Home() {
  await guardPage();
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness((await appDb()));
  // A new live owner starts with the guided setup.
  if (!business && !dryRun) redirect("/welcome");
  const setup = business && !dryRun ? await onboardingState((await appDb()), await getOwner()) : null;

  if (!business) {
    return (
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="display text-4xl leading-tight sm:text-5xl">Pay everyone. Never the wrong person.</h1>
          <p className="mt-3 text-lg text-muted">Your agent pays staff and suppliers inside limits it can&apos;t change.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-card p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ledger-soft text-sm font-bold text-ledger">{i + 1}</span>
              <p className="mt-3 font-bold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        {dryRun ? (
          <div className="rounded-2xl border border-line bg-card p-6">
            <h2 className="text-lg font-bold">Try a sample restaurant</h2>
            <p className="mt-1 text-sm text-muted">Bukka Corner, Lagos: 6 people, a week of invoices. Practice money only.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionForm action={loadSample} submit="Open the sample restaurant" />
              <Link href="/welcome" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-paper">
                Set up my own business
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  let status: AccountStatus | null = null;
  let accountError: string | null = null;
  try {
    status = await (await agentAccount((await appDb()))).status();
  } catch (e) {
    accountError = friendlyError(e, "Bursr couldn't reach your wallet just now.");
  }
  const [payees, feed, invoices, plan, waitingOnYou, upcoming, recent] = await Promise.all([
    listPayees((await appDb())),
    agentFeed((await appDb()), 5),
    listInvoices((await appDb())),
    getLatestPlan((await appDb())),
    needsYou((await appDb())),
    comingUp((await appDb())),
    recentPayments(await appDb()),
  ]);
  const treasury = business.rules.treasury;
  const needsLook = invoices.filter((i) => !["ready", "flag"].includes(i.status)).length;
  const planWaiting = plan?.status === "draft" ? plan.items.filter((i) => i.placement === "in").length : 0;

  const inPlan = plan?.items.filter((i) => i.placement === "in") ?? [];
  const paidCount = inPlan.filter((i) => i.payStatus === "delivered").length;
  const cap = BigInt(business.rules.weeklyCapUsd);
  const spent = status?.spentThisWeekUsd ?? 0n;
  const left = cap > spent ? cap - spent : 0n;
  const pct = cap > 0n ? Math.min(100, Number((spent * 1000n) / cap) / 10) : 100;
  const payday = nextPayday(new Date(), business.rules.timeZone, business.rules.paydayWeekday);
  const frozen = status?.frozen ?? business.rules.frozen;

  return (
    <div className="space-y-6">
      <AutoRefresh active everyMs={5000} />
      <div>
        <p className="text-sm text-muted">{greeting()}</p>
        <h1 className="display text-2xl sm:text-3xl">{business.name}</h1>
      </div>

      {setup && !setup.done.agent && (
        <Link href="/welcome" className="flex items-center justify-between gap-3 rounded-2xl border border-ledger/30 bg-ledger-soft px-5 py-4 text-sm">
          <span>
            <span className="font-semibold">Finish setup:</span> {STEP_TITLES[setup.current].toLowerCase()}
          </span>
          <ArrowRight size={16} weight="bold" aria-hidden />
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {status ? (
            <BalanceCard
              balance={formatUsd(rescale(status.balances[treasury.assetId] ?? 0n, treasury.decimals, 6))}
              left={formatUsd(left)}
              used={formatUsd(spent)}
              cap={formatUsd(cap)}
              pct={pct}
              refills={status.weekResetsAt ? status.weekResetsAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : null}
              status={frozen ? "Paused" : business.rules.autopilot ? "Agent working" : "Agent waits for you"}
              tone={frozen ? "paused" : business.rules.autopilot ? "on" : "manual"}
            />
          ) : (
            <p className="rounded-2xl bg-hold-soft px-5 py-4 text-sm text-hold">{accountError}</p>
          )}

          <AgentLine entry={feed.find((e) => e.by === "agent")} />

          <NeedsYouList items={waitingOnYou} limit={3} />

          <RecentPayments rows={recent} />
        </div>

        <aside className="space-y-6">
          <section aria-label="This week" className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Next payday</p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-xl font-bold">{dayWords(payday)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${frozen ? "bg-refuse-soft text-refuse" : "bg-ok-soft text-ok"}`}>
                {frozen ? <Lock size={12} weight="bold" aria-hidden /> : <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ok" />}
                {frozen ? "Paused" : "Payments on"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-paper px-3 py-2.5">
                <dt className="text-xs text-muted">Paid this week</dt>
                <dd className="num mt-0.5 font-semibold">{inPlan.length > 0 ? `${paidCount} of ${inPlan.length}` : "0"}</dd>
              </div>
              <div className="rounded-xl bg-paper px-3 py-2.5">
                <dt className="text-xs text-muted">Largest payment</dt>
                <dd className="num mt-0.5 font-semibold">{formatUsd(BigInt(business.rules.perPaymentCapUsd))}</dd>
              </div>
            </dl>
            {(planWaiting > 0 || needsLook > 0) && (
              <div className="mt-3 space-y-2">
                {planWaiting > 0 && (
                  <Link href="/payments" className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm font-semibold hover:bg-paper">
                    {planWaiting} payments ready for your OK <ArrowRight size={14} weight="bold" aria-hidden />
                  </Link>
                )}
                {needsLook > 0 && (
                  <Link href="/invoices" className="flex items-center justify-between rounded-xl border border-hold/30 bg-hold-soft/60 px-3 py-2.5 text-sm font-semibold text-hold hover:bg-hold-soft">
                    {needsLook} invoice{needsLook === 1 ? "" : "s"} need{needsLook === 1 ? "s" : ""} a look <ArrowRight size={14} weight="bold" aria-hidden />
                  </Link>
                )}
              </div>
            )}
            {!frozen && (
              <div className="mt-4 border-t border-line pt-4">
                <ActionForm action={runPaydayNowAction} submit="Run payday now" tone="quiet" />
              </div>
            )}
          </section>
          <ComingUp items={upcoming} />
          <Link href="/people" className="flex items-center justify-between rounded-2xl border border-line bg-card px-5 py-4 text-sm hover:bg-paper">
            <span>
              <span className="font-semibold">{payees.length} people</span> <span className="text-muted">on your list</span>
            </span>
            <ArrowRight size={16} weight="bold" aria-hidden />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
