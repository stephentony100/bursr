import { shortenAddresses } from "@/lib/address";
import { connection } from "next/server";
import { saveRules, telegramLinkAction, testRule, toggleFreeze } from "@/app/actions";
import { linkedChat } from "@/lib/telegram";
import { ActionForm, RuleTester } from "@/components/forms";
import { WalletPanel } from "@/components/wallet-panel";
import { agentAccount, type AccountStatus } from "@/lib/agent-account";
import { readEnv } from "@/lib/env";
import { formatUnits, USD_DECIMALS } from "@/lib/money";
import { grantState } from "@/lib/grant-store";
import { policyNeedsSigning } from "@/lib/owner-actions";
import { getOwner, guardPage, appDb } from "@/lib/session";
import { getAccountRecord, getBusiness } from "@/lib/store";
import { chainName, payoutTokens } from "@/lib/tokens";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SetupPage() {
  await guardPage();
  await connection();
  const env = readEnv();
  const dryRun = env.BURSAR_MODE === "dry-run";
  const [business, owner, record, tokens] = await Promise.all([getBusiness((await appDb())), getOwner(), getAccountRecord((await appDb())), payoutTokens()]);

  let status: AccountStatus | null = null;
  const grant = grantState(record);
  if (business && (dryRun || grant.usable)) {
    try {
      status = await (await agentAccount((await appDb()))).status();
    } catch {
      status = null;
    }
  }
  const needsSigning = !dryRun && (await policyNeedsSigning((await appDb())));
  const telegram = env.TELEGRAM_BOT_TOKEN ? await linkedChat((await appDb())) : null;
  const r = business?.rules;
  const usd = (micros: string) => formatUnits(BigInt(micros), USD_DECIMALS);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-2xl sm:text-3xl">Limits</h1>
        <p className="mt-1 text-muted">Locked in your wallet. The AI can&apos;t change them.</p>
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
        <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h2 className="text-lg font-bold">Your limits</h2>
          <ActionForm action={saveRules} submit={dryRun ? "Save my limits" : "Save my limits (then confirm with your wallet)"}>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <Money name="weeklyCap" label="Weekly limit" hint={dryRun ? "The most that can go out in any 7 days." : "The most that can go out in any 7 days. A payment in another currency or network counts twice (the exchange, then the payment)."} value={usd(r.weeklyCapUsd)} />
              <Money name="perPaymentCap" label="Largest single payment" hint="Anything bigger is stopped, always." value={usd(r.perPaymentCapUsd)} />
              <Money name="approvalThreshold" label="Ask me first above" hint="Bigger payments wait for your own OK." value={usd(r.approvalThresholdUsd)} />
            </div>
            <label className="mt-5 block text-sm font-medium">
              Payday
              <select name="payday" defaultValue={r.paydayWeekday} className="mt-1 block rounded-xl border border-line bg-card px-3 py-2">
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    Every {d}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="mt-5 rounded-xl border border-line bg-paper p-4">
              <legend className="px-1 text-sm font-medium">What the agent does on its own</legend>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="autopilot" defaultChecked={r.autopilot} className="mt-1" />
                <span>
                  <span className="font-medium">Autopilot: pay routine payments without asking me</span>
                  <span className="block text-muted">Anything unusual still waits for your OK.</span>
                </span>
              </label>
              <label className="mt-3 block text-sm font-medium">
                Pay supplier invoices
                <select name="invoiceTiming" defaultValue={r.invoiceTiming} className="mt-1 block rounded-xl border border-line bg-card px-3 py-2">
                  <option value="due">The day before they&apos;re due</option>
                  <option value="asap">As soon as they pass every check</option>
                </select>
              </label>
            </fieldset>
            <p className="mt-5 text-sm">
              <span className="font-medium">Bursr&apos;s fee: </span>
              {r.fee ? (
                <>
                  {(r.fee.bps / 100).toFixed(2).replace(/\.?0+$/, "")}% of each payment run, to one fixed address (
                  <span className="addr" title={r.fee.payout.address}>{shortenAddresses(r.fee.payout.address)}</span>).
                </>
              ) : (
                "none."
              )}
            </p>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">How people can get paid</legend>
              <p className="text-sm text-muted">Each person picks one of these when they join.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tokens.map((t) => (
                  <label key={t.assetId} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm has-[:checked]:border-ledger has-[:checked]:bg-ledger-soft">
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
        <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h2 className="text-lg font-bold">Emergency stop</h2>
          <p className="mt-1 text-sm text-muted">
            One tap stops every payment.{" "}
            {status.frozen ? <strong className="text-refuse">All payments are paused right now.</strong> : "Payments are on right now."}
          </p>
          <ActionForm action={toggleFreeze} submit={status.frozen ? "Turn payments back on" : "Pause all payments"} tone={status.frozen ? "primary" : "danger"}>
            <input type="hidden" name="freeze" value={status.frozen ? "0" : "1"} />
          </ActionForm>
        </section>
      )}

      {r && env.TELEGRAM_BOT_TOKEN && (
        <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h2 className="text-lg font-bold">Telegram</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Alerts and approvals on your phone.{" "}
            {telegram ? <strong className="text-ok">Connected.</strong> : "Not connected yet."}
          </p>
          <ActionForm action={telegramLinkAction} submit={telegram ? "Connect a different chat" : "Connect my Telegram"} tone="quiet" />
        </section>
      )}

      {r && status && (
        <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
          <h2 className="text-lg font-bold">See your limits in action</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Ask your wallet if it would allow a payment. Nothing is paid.
          </p>
          <div className="mt-4">
            <RuleTester action={testRule} />
          </div>
          <details className="mt-6 text-sm">
            <summary className="cursor-pointer text-muted">Technical details: the exact rules your wallet enforces (version {status.policyRevision})</summary>
            <pre className="num mt-2 max-h-80 overflow-auto rounded-xl bg-paper p-3 text-xs">{JSON.stringify(status.policy, null, 2)}</pre>
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
      <span className="mt-1 flex items-center rounded-xl border border-line bg-card ">
        <span className="pl-3 text-muted">$</span>
        <input name={name} defaultValue={value} inputMode="decimal" required className="num w-full bg-transparent px-2 py-2 outline-none" />
      </span>
      <span className="mt-1 block font-normal text-muted">{hint}</span>
    </label>
  );
}
