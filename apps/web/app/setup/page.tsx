import { connection } from "next/server";
import { saveRules, testRule, toggleFreeze } from "@/app/actions";
import { ActionForm, RuleTester } from "@/components/forms";
import { WalletPanel } from "@/components/wallet-panel";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { formatUnits, USD_DECIMALS } from "@/lib/money";
import { policyNeedsSigning } from "@/lib/owner-actions";
import { getOwner } from "@/lib/session";
import { getAccountRecord, getBusiness } from "@/lib/store";
import { chainName, payoutTokens } from "@/lib/tokens";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SetupPage() {
  await connection();
  const env = readEnv();
  const dryRun = env.BURSAR_MODE === "dry-run";
  const [business, owner, record, tokens] = await Promise.all([getBusiness(db()), getOwner(), getAccountRecord(db()), payoutTokens()]);

  let status: AccountStatus | null = null;
  if (business && (dryRun || (record && env.AGENT_API_GRANT_TOKEN))) {
    try {
      status = await (await agentAccount(db())).status();
    } catch {
      status = null;
    }
  }
  const needsSigning = !dryRun && (await policyNeedsSigning(db()));
  const r = business?.rules;
  const usd = (micros: string) => formatUnits(BigInt(micros), USD_DECIMALS);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold">Rules &amp; account</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Your rules are written into the agent&apos;s account. The account itself refuses any payment that breaks them. Bursar&apos;s AI
          can only ask; it can&apos;t change your rules or your payee list.
        </p>
      </div>

      {!dryRun && (
        <WalletPanel
          ownerAccountId={owner?.accountId ?? null}
          businessExists={Boolean(business)}
          businessOwner={business?.ownerAccountId ?? null}
          agentId={record?.agentId ?? null}
          needsSigning={needsSigning}
          hasGrant={Boolean(env.AGENT_API_GRANT_TOKEN)}
          frozen={r?.frozen ?? false}
        />
      )}

      {r && (
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Spending rules</h2>
          <ActionForm action={saveRules} submit={dryRun ? "Save rules" : "Save rules (then sign them with your wallet)"}>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Money name="weeklyCap" label="Weekly limit" hint="The most that can leave in any 7 days." value={usd(r.weeklyCapUsd)} />
              <Money name="perPaymentCap" label="Largest single payment" hint="Anything bigger is refused." value={usd(r.perPaymentCapUsd)} />
              <Money name="approvalThreshold" label="Ask me first above" hint="Bigger payments need your own tap." value={usd(r.approvalThresholdUsd)} />
            </div>
            <label className="mt-5 block text-sm font-medium">
              Payday
              <select name="payday" defaultValue={r.paydayWeekday} className="mt-1 block rounded-md border border-line bg-card px-3 py-2">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    Every {d}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-5 text-sm">
              <span className="font-medium">Bursar&apos;s fee: </span>
              {r.fee ? (
                <>
                  {(r.fee.bps / 100).toFixed(2).replace(/\.?0+$/, "")}% of each plan, paid in {r.fee.payout.token.symbol} to{" "}
                  <span className="num text-xs">{r.fee.payout.address}</span>. It is on your signed payee list like anyone else, so it can only go there.
                </>
              ) : (
                "none."
              )}
            </p>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">Ways you can pay people</legend>
              <p className="text-sm text-muted">You pay from {r.treasury.symbol} on {chainName(r.treasury.chain)}. Payees can receive any of these.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tokens.map((t) => (
                  <label key={t.assetId} className="flex items-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm has-[:checked]:border-ledger has-[:checked]:bg-ledger-soft">
                    <input type="checkbox" name="payoutToken" value={t.assetId} defaultChecked={r.payoutTokens.some((p) => p.assetId === t.assetId)} />
                    {t.symbol} on {chainName(t.chain)}
                  </label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        </section>
      )}

      {r && dryRun && status && (
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Freeze all payments</h2>
          <p className="mt-1 text-sm text-muted">
            One switch stops every payment until you turn it back on.{" "}
            {status.frozen ? <strong className="text-refuse">Payments are frozen now.</strong> : "Payments are allowed now."}
          </p>
          <ActionForm action={toggleFreeze} submit={status.frozen ? "Unfreeze payments" : "Freeze all payments"} tone={status.frozen ? "primary" : "danger"}>
            <input type="hidden" name="freeze" value={status.frozen ? "0" : "1"} />
          </ActionForm>
        </section>
      )}

      {r && status && (
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="font-display text-xl font-semibold">Test the rules</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Ask the account what it would do with a payment. Nothing is paid. {dryRun ? "In practice mode the account is simulated with the same rules the real one uses." : "The answer comes from the live account."}
          </p>
          <div className="mt-4">
            <RuleTester action={testRule} />
          </div>
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-muted">What the account enforces (revision {status.policyRevision})</summary>
            <pre className="num mt-2 max-h-80 overflow-auto rounded-md bg-paper p-3 text-xs">{JSON.stringify(status.policy, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}

function Money({ name, label, hint, value }: { name: string; label: string; hint: string; value: string }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <span className="mt-1 flex items-center rounded-md border border-line bg-card focus-within:outline-2 focus-within:outline-indigo">
        <span className="pl-3 text-muted">$</span>
        <input name={name} defaultValue={value} inputMode="decimal" required className="num w-full bg-transparent px-2 py-2 outline-none" />
      </span>
      <span className="mt-1 block font-normal text-muted">{hint}</span>
    </label>
  );
}
