import Link from "next/link";
import { connection } from "next/server";
import { loadSample } from "@/app/actions";
import { Envelope } from "@/components/envelope";
import { ActionForm } from "@/components/forms";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { formatUnits, formatUsd } from "@/lib/money";
import { getBusiness, listPayees, recentAudit } from "@/lib/store";
import { chainName } from "@/lib/tokens";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Home() {
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());

  if (!business) {
    return (
      <div className="max-w-xl">
        <h1 className="font-display text-3xl font-semibold">Nothing set up yet</h1>
        {dryRun ? (
          <>
            <p className="mt-3 text-muted">
              Load a sample restaurant to try Bursar with demo money. Nothing real is paid in practice mode.
            </p>
            <ActionForm action={loadSample} submit="Load the sample restaurant" />
          </>
        ) : (
          <p className="mt-3 text-muted">
            Go to <Link href="/setup" className="text-indigo underline">Rules &amp; account</Link> and sign in with your NEAR wallet to set up your business.
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
    accountError = e instanceof Error ? e.message : "The account could not be reached.";
  }
  const [payees, activity] = await Promise.all([listPayees(db()), recentAudit(db(), 12)]);
  const treasury = business.rules.treasury;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Payday is every {DAYS[business.rules.paydayWeekday]}</p>
        <h1 className="font-display text-3xl font-semibold">{business.name}</h1>
      </div>

      {status ? (
        <>
          <Envelope spent={status.spentThisWeekUsd} cap={BigInt(business.rules.weeklyCapUsd)} resetsAt={status.weekResetsAt} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Fact label="Payments">
              {status.frozen ? <span className="text-refuse">Frozen 🔒</span> : <span className="text-ledger">Allowed</span>}
            </Fact>
            <Fact label={`Money to pay from (${treasury.symbol} on ${chainName(treasury.chain)})`}>
              <span className="num">${formatUnits(status.balances[treasury.assetId] ?? 0n, treasury.decimals)}</span>
            </Fact>
            <Fact label="Largest single payment">
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
            Manage payees
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          {payees.filter((p) => p.category === "supplier").length} suppliers, {payees.filter((p) => p.category === "staff").length} staff,{" "}
          {payees.filter((p) => p.category === "software").length} software. Only you can add people or change where they are paid.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">What happened</h2>
        <ol className="mt-3 divide-y divide-line rounded-xl border border-line bg-card">
          {activity.length === 0 && <li className="px-4 py-3 text-sm text-muted">Nothing yet.</li>}
          {activity.map((a) => (
            <li key={a.id} className="flex gap-4 px-4 py-3 text-sm">
              <time className="num w-32 shrink-0 text-muted" dateTime={a.at.toISOString()}>
                {a.at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </time>
              <span className={a.kind === "account_refused" ? "text-refuse" : a.kind === "payout_changed" ? "text-hold" : ""}>
                {a.kind === "account_refused" ? "The account refused a payment: " : ""}
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
