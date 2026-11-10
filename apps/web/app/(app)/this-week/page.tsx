import { ArrowRight, Lock } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { loadSample } from "@/app/actions";
import { AgentFeed, AgentStatus, ComingUp, NeedsYouList } from "@/components/agent-panel";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm } from "@/components/forms";
import { agentFeed, comingUp, needsYou, nextPayday } from "@/lib/agent/view";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { listInvoices } from "@/lib/invoices";
import { formatUsd, rescale } from "@/lib/money";
import { getLatestPlan } from "@/lib/plans";
import { onboardingState, STEP_TITLES } from "@/lib/onboarding";
import { getOwner, guardPage } from "@/lib/session";
import { getBusiness, listPayees } from "@/lib/store";
import { friendlyError } from "@/lib/errors";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STEPS = [
  { title: "Send in your invoices", body: "Snap a photo or paste the text. Bursar reads every line for you." },
  { title: "Bursar checks every one", body: "Fake suppliers, changed bank details, double bills and overcharges are stopped before you pay." },
  { title: "Your agent pays on time", body: "It pays staff and suppliers on their day, in the digital dollars each one prefers, inside the limits you set." },
];

export default async function Home() {
  await guardPage();
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());
  // A new live owner starts with the guided setup.
  if (!business && !dryRun) redirect("/welcome");
  const setup = business && !dryRun ? await onboardingState(db(), await getOwner()) : null;

  if (!business) {
    return (
      <div className="max-w-3xl space-y-10">
        <div>
          <h1 className="display text-5xl leading-[0.98]">Pay your suppliers and staff without the fear of paying the wrong person.</h1>
          <p className="mt-4 text-lg text-muted">
            Bursar reads your invoices, catches fraud and mistakes, and pays everyone once a week after you say yes. It can never spend more
            than you allow.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-card p-5">
              <p className="text-sm tabular-nums text-muted">Step {i + 1}</p>
              <p className="mt-1 text-lg font-bold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        {dryRun ? (
          <div className="rounded-xl border border-line bg-card p-6">
            <h2 className="text-xl font-bold">See it with a sample restaurant</h2>
            <p className="mt-1 text-muted">
              Meet Bukka Corner, a Lagos restaurant with three suppliers, three staff and a week of invoices, including a few tricky ones. You
              play the owner. All the money is practice money.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionForm action={loadSample} submit="Open the sample restaurant" />
              <Link href="/welcome" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold hover:border-ink/40">
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
    status = await (await agentAccount(db())).status();
  } catch (e) {
    accountError = friendlyError(e, "Bursar couldn't reach your wallet just now.");
  }
  const [payees, feed, invoices, plan, waitingOnYou, upcoming] = await Promise.all([
    listPayees(db()),
    agentFeed(db(), 25),
    listInvoices(db()),
    getLatestPlan(db()),
    needsYou(db()),
    comingUp(db()),
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
  const counts = {
    suppliers: payees.filter((p) => p.category === "supplier").length,
    staff: payees.filter((p) => p.category === "staff").length,
    software: payees.filter((p) => p.category === "software").length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl">{business.name}</h1>
          <p className="mt-1 text-muted">Payday is every {DAYS[business.rules.paydayWeekday]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/invoices" className="rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-ink/40">
            Review invoices
          </Link>
          <Link href="/payments" className="rounded-md bg-ledger px-4 py-2 text-sm font-semibold text-card hover:bg-indigo">
            This week&apos;s payments
          </Link>
        </div>
      </div>

      <AutoRefresh active everyMs={5000} />
      {setup && !setup.done.agent && (
        <Link href="/welcome" className="flex items-center justify-between gap-3 rounded-xl border border-ledger/40 bg-ledger-soft px-5 py-4">
          <span>
            <span className="font-semibold">Finish setting up: {STEP_TITLES[setup.current].toLowerCase()}.</span> Your agent starts paying once it&apos;s on.
          </span>
          <ArrowRight size={16} weight="bold" aria-hidden />
        </Link>
      )}
      <AgentStatus autopilot={business.rules.autopilot} frozen={business.rules.frozen} nextPayday={nextPayday(new Date(), business.rules.timeZone, business.rules.paydayWeekday)} />
      <NeedsYouList items={waitingOnYou} />

      {(needsLook > 0 || planWaiting > 0) && (
        <div className="flex flex-wrap gap-3">
          {planWaiting > 0 && (
            <Link href="/payments" className="flex items-center gap-2 rounded-lg border border-ledger/30 bg-ledger-soft px-4 py-2.5 text-sm">
              <span className="font-semibold">{planWaiting} payments are ready for your OK.</span> Review and approve <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          )}
          {needsLook > 0 && (
            <Link href="/invoices" className="flex items-center gap-2 rounded-lg border border-hold/30 bg-hold-soft px-4 py-2.5 text-sm">
              <span className="font-semibold">
                {needsLook} invoice{needsLook === 1 ? "" : "s"} need{needsLook === 1 ? "s" : ""} a look.
              </span>{" "}
              See why <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          )}
        </div>
      )}

      {status ? (
        <section aria-label="This week at a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Left to spend this week" value={<span className="num">{formatUsd(left)}</span>}>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Share of the weekly limit used">
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-refuse" : pct >= 80 ? "bg-hold" : "bg-ledger"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted">
              <span className="num">{formatUsd(spent)}</span> of <span className="num">{formatUsd(cap)}</span> used
              {status.weekResetsAt && <>, refills {status.weekResetsAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</>}
            </p>
          </Kpi>
          <Kpi label="Money in your Bursar wallet" value={<span className="num">{formatUsd(rescale(status.balances[treasury.assetId] ?? 0n, treasury.decimals, 6))}</span>}>
            <p className="mt-3 flex items-center justify-between text-xs text-muted">
              {treasury.symbol} held for payouts
              <Link href="/add-money" className="font-semibold text-indigo underline">
                Add money
              </Link>
            </p>
          </Kpi>
          <Kpi label="Largest single payment allowed" value={<span className="num">{formatUsd(BigInt(business.rules.perPaymentCapUsd))}</span>}>
            <p className="mt-3 text-xs text-muted">Bigger payments are refused by the wallet</p>
          </Kpi>
          <Kpi
            label="Payments"
            value={
              status.frozen ? (
                <span className="inline-flex items-center gap-1.5 text-refuse">
                  <Lock size={20} weight="bold" aria-hidden /> Paused
                </span>
              ) : (
                <span className="text-ledger">On</span>
              )
            }
          >
            <p className="mt-3 text-xs text-muted">{inPlan.length > 0 ? `${paidCount} of ${inPlan.length} paid this week` : "No list prepared yet this week"}</p>
          </Kpi>
        </section>
      ) : (
        <p className="rounded-md bg-hold-soft px-4 py-3 text-sm text-hold">{accountError}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <AgentFeed entries={feed} />

        <aside className="space-y-6">
          <ComingUp items={upcoming} />
          <section className="rounded-xl border border-line bg-card p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-bold">People you pay</h2>
              <Link href="/people" className="text-sm text-indigo underline">
                See everyone
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Suppliers", counts.suppliers],
                ["Staff", counts.staff],
                ["Software", counts.software],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-paper-2/70 px-2 py-3">
                  <dd className="num text-2xl font-semibold">{v}</dd>
                  <dt className="mt-0.5 text-[0.7rem] text-muted [overflow-wrap:normal]">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted">
              {counts.suppliers} suppliers, {counts.staff} staff, {counts.software} subscriptions. Only you can add someone or change where they get paid.
            </p>
          </section>
          <section className="rounded-xl border border-line bg-card p-5">
            <h2 className="text-base font-bold">Invoices this week</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Received</dt>
                <dd className="num">{invoices.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Ready to pay</dt>
                <dd className="num text-ledger">{invoices.length - needsLook}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Need a look</dt>
                <dd className="num text-hold">{needsLook}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Kpi({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 whitespace-nowrap text-3xl font-semibold tracking-tight">{value}</p>
      {children}
    </div>
  );
}

