import { connection } from "next/server";
import { practiceMoneyAction } from "@/app/actions";
import { AddMoney } from "@/components/add-money";
import { ActionForm } from "@/components/forms";
import { agentAccount } from "@/lib/agent-account";
import { comingUp, nextPayday } from "@/lib/agent/view";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { formatUnits, formatUsd, rescale, USD_DECIMALS } from "@/lib/money";
import { getBusiness } from "@/lib/store";

export default async function AddMoneyPage() {
  await connection();
  const business = await getBusiness(db());
  if (!business) return <p className="text-muted">Set up your business first.</p>;
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const t = business.rules.treasury;
  let balance: bigint | null = null;
  try {
    const s = await (await agentAccount(db())).status();
    balance = rescale(s.balances[t.assetId] ?? 0n, t.decimals, USD_DECIMALS);
  } catch {
    balance = null;
  }
  const payday = nextPayday(new Date(), business.rules.timeZone, business.rules.paydayWeekday);
  const due = (await comingUp(db())).filter((u) => u.dueOn <= payday).reduce((a, u) => a + u.amountUsd, 0n);
  const short = balance !== null && due > balance ? due - balance : 0n;
  const paydayWords = new Date(`${payday}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="display text-4xl">Add money</h1>
        <p className="mt-2 text-muted">
          Your agent pays people from your Bursar wallet, never from your own wallet. Top it up here; the agent tells you when the money has arrived and uses it for anything
          that was waiting.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="text-sm font-medium text-muted">In your Bursar wallet</p>
          <p className="num mt-2 text-3xl font-semibold">{balance === null ? "…" : formatUsd(balance)}</p>
        </div>
        <div className={`rounded-xl border p-5 ${short > 0n ? "border-hold/40 bg-hold-soft/60" : "border-line bg-card"}`}>
          <p className="text-sm font-medium text-muted">Due by {paydayWords}</p>
          <p className="num mt-2 text-3xl font-semibold">{formatUsd(due)}</p>
          <p className="mt-1 text-sm">{short > 0n ? `Add at least ${formatUsd(short)} so nobody waits.` : "You have enough for it."}</p>
        </div>
      </section>

      {dryRun ? (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-base font-bold">Practice money</h2>
          <p className="mt-1 text-sm text-muted">In practice mode, add pretend dollars with one tap. In live mode this page tops up from your own wallet.</p>
          <ActionForm action={practiceMoneyAction} submit="Add practice money">
            <input type="hidden" name="amount" value={short > 0n ? formatUnits(short + 100_000_000n, USD_DECIMALS).split(".")[0] : "500"} />
          </ActionForm>
        </section>
      ) : (
        <AddMoney suggestedUsd={short > 0n ? formatUnits(short, USD_DECIMALS).replace(/\.?0+$/, "") : null} />
      )}

      <section className="rounded-xl border border-dashed border-line p-5">
        <h2 className="text-base font-bold">With a card or bank transfer</h2>
        <p className="mt-1 text-sm text-muted">
          Coming soon: pay by card or bank transfer (including naira) and the dollars land straight in your Bursar wallet. No crypto app needed.
        </p>
      </section>
    </div>
  );
}
