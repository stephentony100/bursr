import Link from "next/link";
import { connection } from "next/server";
import { loadSample } from "@/app/actions";
import { Envelope } from "@/components/envelope";
import { ActionForm } from "@/components/forms";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { listInvoices } from "@/lib/invoices";
import { formatUnits, formatUsd } from "@/lib/money";
import { getLatestPlan } from "@/lib/plans";
import { getBusiness, listPayees, recentAudit } from "@/lib/store";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STEPS = [
  { title: "Send in your invoices", body: "Snap a photo or paste the text. Bursar reads every line for you." },
  { title: "Bursar checks every one", body: "Fake suppliers, changed bank details, double bills and overcharges are stopped before you pay." },
  { title: "Approve once a week", body: "One tap pays your suppliers and staff, in the digital dollars they prefer, inside your limits." },
];

export default async function Home() {
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());

  if (!business) {
    return (
      <div className="max-w-3xl space-y-10">
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight">Pay your suppliers and staff without the fear of paying the wrong person.</h1>
          <p className="mt-4 text-lg text-muted">
            Bursar reads your invoices, catches fraud and mistakes, and pays everyone once a week after you say yes. It can never spend more
            than you allow.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-line bg-card p-5">
              <p className="num text-sm text-muted">Step {i + 1}</p>
              <p className="mt-1 font-display text-lg font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        {dryRun ? (
          <div className="rounded-xl border border-line bg-card p-6">
            <h2 className="font-display text-xl font-semibold">See it with a sample restaurant</h2>
            <p className="mt-1 text-muted">
              Meet Bukka Corner, a Lagos restaurant with three suppliers, three staff and a week of invoices, including a few tricky ones. You
              play the owner. All the money is practice money.
            </p>
            <ActionForm action={loadSample} submit="Open the sample restaurant" />
          </div>
        ) : (
          <p className="text-muted">
            To begin, press <strong>Sign in</strong> at the top right, then open{" "}
            <Link href="/setup" className="text-indigo underline">
              Spending rules
            </Link>{" "}
            to set up your business.
          </p>
        )}
      </div>
    );
  }

  let status: AccountStatus | null = null;
  let accountError: string | null = null;
  try {
    status = await (await agentAccount(db())).status();
  } catch (e) {
    accountError = e instanceof Error ? e.message : "Bursar couldn't reach your wallet just now.";
  }
  const [payees, activity, invoices, plan] = await Promise.all([listPayees(db()), recentAudit(db(), 12), listInvoices(db()), getLatestPlan(db())]);
  const treasury = business.rules.treasury;
  const needsLook = invoices.filter((i) => !["ready", "flag"].includes(i.status)).length;
  const planWaiting = plan?.status === "draft" ? plan.items.filter((i) => i.placement === "in").length : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Payday is every {DAYS[business.rules.paydayWeekday]}</p>
        <h1 className="font-display text-3xl font-semibold">{business.name}</h1>
      </div>

      {(needsLook > 0 || planWaiting > 0) && (
        <div className="flex flex-wrap gap-3">
          {planWaiting > 0 && (
            <Link href="/plan" className="rounded-xl border-2 border-ledger/40 bg-ledger-soft px-5 py-3 text-sm">
              <span className="font-semibold">{planWaiting} payments are ready for your OK.</span> Review and approve →
            </Link>
          )}
          {needsLook > 0 && (
            <Link href="/invoices" className="rounded-xl border-2 border-hold/40 bg-hold-soft px-5 py-3 text-sm">
              <span className="font-semibold">
                {needsLook} invoice{needsLook === 1 ? "" : "s"} need{needsLook === 1 ? "s" : ""} a look.
              </span>{" "}
              See why →
            </Link>
          )}
        </div>
      )}

      {status ? (
        <>
          <Envelope spent={status.spentThisWeekUsd} cap={BigInt(business.rules.weeklyCapUsd)} resetsAt={status.weekResetsAt} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Fact label="Payments">
              {status.frozen ? <span className="text-refuse">Paused 🔒</span> : <span className="text-ledger">On</span>}
            </Fact>
            <Fact label="Money in your Bursar wallet">
              <span className="num">${formatUnits(status.balances[treasury.assetId] ?? 0n, treasury.decimals)}</span>
            </Fact>
            <Fact label="Largest single payment allowed">
              <span className="num">{formatUsd(BigInt(business.rules.perPaymentCapUsd))}</span>
            </Fact>
          </div>
        </>
      ) : (
        <p className="rounded-md bg-hold-soft px-4 py-3 text-sm text-hold">{accountError}</p>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">People you pay</h2>
          <Link href="/payees" className="text-sm text-indigo underline">
            See everyone
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          {payees.filter((p) => p.category === "supplier").length} suppliers, {payees.filter((p) => p.category === "staff").length} staff,{" "}
          {payees.filter((p) => p.category === "software").length} subscriptions. Only you can add someone or change where they get paid.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Latest activity</h2>
        <ol className="mt-3 divide-y divide-line rounded-xl border border-line bg-card">
          {activity.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing yet.</li>}
          {activity.map((a) => (
            <li key={a.id} className="flex gap-4 px-4 py-3 text-sm">
              <time className="num w-32 shrink-0 text-muted" dateTime={a.at.toISOString()}>
                {a.at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </time>
              <span className={a.kind === "account_refused" ? "text-refuse" : a.kind === "payout_changed" ? "text-hold" : ""}>
                {a.kind === "account_refused" ? "🛡 Blocked by your spending rules: " : ""}
                {a.message}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{children}</p>
    </div>
  );
}
