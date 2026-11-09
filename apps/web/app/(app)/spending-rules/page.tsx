import { shortenAddresses } from "@/lib/address";
import { connection } from "next/server";
import { saveRules, telegramLinkAction, testRule, toggleFreeze } from "@/app/actions";
import { linkedChat } from "@/lib/telegram";
import { ActionForm, RuleTester } from "@/components/forms";
import { WalletPanel } from "@/components/wallet-panel";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { formatUnits, USD_DECIMALS } from "@/lib/money";
import { grantState } from "@/lib/grant-store";
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
  const grant = grantState(record);
  if (business && (dryRun || grant.usable)) {
    try {
      status = await (await agentAccount(db())).status();
    } catch {
      status = null;
    }
  }
  const needsSigning = !dryRun && (await policyNeedsSigning(db()));
  const telegram = env.TELEGRAM_BOT_TOKEN ? await linkedChat(db()) : null;
  const r = business?.rules;
  const usd = (micros: string) => formatUnits(BigInt(micros), USD_DECIMALS);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-4xl">Spending rules</h1>
        <p className="mt-2 max-w-2xl text-muted">
          You set the limits once. They&apos;re locked into your Bursar wallet itself, so any payment that breaks them is stopped there,
          no matter what. Bursar&apos;s AI can only ask to pay; it can never change your limits or who you pay.
        </p>
      </div>

      {!dryRun && (
        <WalletPanel
          ownerAccountId={owner?.accountId ?? null}
          businessExists={Boolean(business)}
          businessOwner={business?.ownerAccountId ?? null}
          agentId={record?.agentId ?? null}
          needsSigning={needsSigning}
          hasGrant={grant.usable}
          grantRenewBy={grant.renewSoon && grant.expiresAt ? grant.expiresAt.toISOString() : null}
          frozen={r?.frozen ?? false}
        />
      )}

      {r && (
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="text-xl font-bold">Your limits</h2>
          <ActionForm action={saveRules} submit={dryRun ? "Save my limits" : "Save my limits (then confirm with your wallet)"}>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Money name="weeklyCap" label="Weekly limit" hint={dryRun ? "The most that can go out in any 7 days." : "The most that can go out in any 7 days. A payment in another currency or network counts twice (the exchange, then the payment)."} value={usd(r.weeklyCapUsd)} />
              <Money name="perPaymentCap" label="Largest single payment" hint="Anything bigger is stopped, always." value={usd(r.perPaymentCapUsd)} />
              <Money name="approvalThreshold" label="Ask me first above" hint="Bigger payments wait for your own OK." value={usd(r.approvalThresholdUsd)} />
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
                  {(r.fee.bps / 100).toFixed(2).replace(/\.?0+$/, "")}% of each week&apos;s payments, shown as its own line before you approve. Like
                  everyone you pay, it can only go to one fixed address (<span className="num text-xs" title={r.fee.payout.address}>{shortenAddresses(r.fee.payout.address)}</span>), so it can
                  never be raised or sent anywhere else.
                </>
              ) : (
                "none."
              )}
            </p>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">How people can get paid</legend>
              <p className="text-sm text-muted">Your Bursar wallet holds digital dollars ({r.treasury.symbol}). Each person can choose to receive any of these, on the network they already use.</p>
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
          <h2 className="text-xl font-bold">Emergency stop</h2>
          <p className="mt-1 text-sm text-muted">
            Something feels wrong? One tap stops every payment until you turn them back on.{" "}
            {status.frozen ? <strong className="text-refuse">All payments are paused right now.</strong> : "Payments are on right now."}
          </p>
          <ActionForm action={toggleFreeze} submit={status.frozen ? "Turn payments back on" : "Pause all payments"} tone={status.frozen ? "primary" : "danger"}>
            <input type="hidden" name="freeze" value={status.frozen ? "0" : "1"} />
          </ActionForm>
        </section>
      )}

      {r && env.TELEGRAM_BOT_TOKEN && (
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="text-xl font-bold">Telegram</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Get a message the moment Bursar stops a suspicious invoice, and approve the week&apos;s payments from your phone.{" "}
            {telegram ? <strong className="text-ledger">Connected.</strong> : "Not connected yet."}
          </p>
          <ActionForm action={telegramLinkAction} submit={telegram ? "Connect a different chat" : "Connect my Telegram"} tone="quiet" />
        </section>
      )}

      {r && status && (
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="text-xl font-bold">See your limits in action</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Pick a payment and Bursar asks your wallet whether it would let it through. Nothing is actually paid.{" "}
            {dryRun ? "In the demo, the wallet follows the same rules with practice money." : "The answer comes from your real wallet."}
          </p>
          <div className="mt-4">
            <RuleTester action={testRule} />
          </div>
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-muted">Technical details: the exact rules your wallet enforces (version {status.policyRevision})</summary>
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
