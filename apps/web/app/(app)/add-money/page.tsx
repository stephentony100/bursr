import { connection } from "next/server";
import { practiceMoneyAction } from "@/app/actions";
import { AddMoney } from "@/components/add-money";
import { MoveHome } from "@/components/move-home";
import { StellarAddMoney, StellarMoveHome } from "@/components/stellar-money";
import { NairaIn, NairaOut } from "@/components/naira-ramp";
import { UsdcDeposit } from "@/components/usdc-deposit";
import { rampPerson, rampProvider, refreshLinqOrders } from "@/lib/ramp-orders";
import { stellarConfig } from "@/lib/stellar";
import { VAULT_MAX_BALANCE } from "@/lib/stellar-vault";
import QRCode from "qrcode";
import { isStellarEdition } from "@/lib/stellar-owner";
import { homeView, type HomeView } from "@/lib/move-home";
import { ActionForm } from "@/components/forms";
import { agentAccount } from "@/lib/agent-account";
import { nextPayday, paydayNeed } from "@/lib/agent/view";
import { getOwner, guardPage, appDb } from "@/lib/session";
import { readEnv } from "@/lib/env";
import { formatUnits, formatUsd, rescale, USD_DECIMALS } from "@/lib/money";
import { getAccountRecord, getBusiness } from "@/lib/store";

export default async function AddMoneyPage() {
  await guardPage();
  await connection();
  const business = await getBusiness((await appDb()));
  if (!business) return <p className="text-muted">Set up your business first.</p>;
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const stellar = isStellarEdition();
  const vaultId = stellar ? ((await getAccountRecord(await appDb()))?.agentId ?? null) : null;
  // A passkey owner (passkey account, `stellar:C…`) has no Stellar wallet to send from or back to: naira in and out instead.
  const passkeyOwner = stellar && Boolean((await getOwner())?.accountId.startsWith("stellar:C"));
  const ramp = stellar ? rampProvider() : null;
  // Linq tries each webhook once: check cash-outs still on their way, and return any refunds.
  if (ramp?.name === "linq") await refreshLinqOrders(await appDb()).catch((e) => console.error("[bursar] Linq refresh", e));
  const vaultQr = stellar && vaultId ? await QRCode.toString(vaultId, { type: "svg", margin: 1, width: 192 }) : null;
  const t = business.rules.treasury;
  let balance: bigint | null = null;
  let home: HomeView | null = null;
  try {
    const account = await agentAccount(await appDb());
    const s = await account.status();
    balance = rescale(s.balances[t.assetId] ?? 0n, t.decimals, USD_DECIMALS);
    if (!stellar) home = await homeView(await appDb(), account);
  } catch {
    balance = null;
  }
  const need = await paydayNeed((await appDb()), balance ?? 0n);
  const payday = need?.payday ?? nextPayday(new Date(), business.rules.timeZone, business.rules.paydayWeekday);
  const due = need?.due ?? 0n;
  const short = balance !== null && due > balance ? due - balance : 0n;
  const paydayWords = new Date(`${payday}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="display text-2xl sm:text-3xl">Wallet</h1>
        <p className="mt-1 text-muted">Your agent pays from here. Top up or take money back.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-card p-5">
          <p className="text-sm font-medium text-muted">In your Bursr wallet</p>
          <p className="num mt-2 text-3xl font-semibold">{balance === null ? "…" : formatUsd(balance)}</p>
        </div>
        <div className={`rounded-2xl border p-5 ${short > 0n ? "border-hold/40 bg-hold-soft/60" : "border-line bg-card"}`}>
          <p className="text-sm font-medium text-muted">Due by {paydayWords}, including payments waiting</p>
          <p className="num mt-2 text-3xl font-semibold">{formatUsd(due)}</p>
          <p className="mt-1 text-sm">{short > 0n ? `Add at least ${formatUsd(short)} so nobody waits.` : "You have enough for it."}</p>
        </div>
      </section>

      {stellar && vaultId && ramp && (
        <NairaIn
          suggestedUsd={short > 0n ? formatUnits(short, USD_DECIMALS).replace(/\.?0+$/, "") : null}
          practice={ramp.name === "practice"}
          needsVerify={ramp.name === "linq" && !(await rampPerson(await appDb()))?.verified}
        />
      )}
      {stellar && vaultId && vaultQr && (
        <UsdcDeposit address={vaultId} qrSvg={vaultQr} cap={formatUsd(rescale(VAULT_MAX_BALANCE, 7, USD_DECIMALS))} testnet={stellarConfig().network.name === "testnet"} />
      )}
      {stellar && vaultId && !ramp && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-base font-bold">Add money from naira</h2>
          <p className="mt-1 text-sm text-muted">Coming soon: send naira by bank transfer and it arrives here as dollars. For now, send USDC to the address above.</p>
        </section>
      )}
      {stellar ? (
        !passkeyOwner && <StellarAddMoney suggestedUsd={short > 0n ? formatUnits(short, USD_DECIMALS).replace(/\.?0+$/, "") : null} vaultId={vaultId} />
      ) : dryRun ? (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-base font-bold">Practice money</h2>
          <p className="mt-1 text-sm text-muted">In practice mode, add pretend dollars with one tap. In live mode this page tops up from your own wallet.</p>
          <ActionForm action={practiceMoneyAction} submit="Add practice money">
            <input type="hidden" name="amount" value={short > 0n ? formatUnits(short + 100_000_000n, USD_DECIMALS).split(".")[0] : "500"} />
          </ActionForm>
        </section>
      ) : (
        <AddMoney suggestedUsd={short > 0n ? formatUnits(short, USD_DECIMALS).replace(/\.?0+$/, "") : null} from={(await getOwner())?.chain === "sui" ? "sui" : "near"} />
      )}

      {stellar && vaultId && ramp && <NairaOut balance={balance === null ? "…" : formatUsd(balance)} practice={ramp.name === "practice"} withPasskey={passkeyOwner} />}
      {stellar && vaultId && !passkeyOwner && <StellarMoveHome balance={balance === null ? "…" : formatUsd(balance)} />}

      {home && (
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="text-base font-bold">Move money back to my wallet</h2>
          <div className="mt-2">
            <MoveHome label={home.label} exchanged={home.exchanged} balance={formatUsd(home.balanceUsd)} canMove={formatUsd(home.canMoveUsd)} limitedBy={home.limitedBy} />
          </div>
        </section>
      )}

      {stellar ? (
        <section className="rounded-2xl border border-dashed border-line p-5">
          <h2 className="text-base font-bold">With naira, through a Stellar anchor</h2>
          <p className="mt-1 text-sm text-muted">Coming next: pay in naira by bank transfer and a Stellar anchor turns it into USDC in your Bursr wallet. Your people cash out to naira the same way.</p>
        </section>
      ) : (
      <section className="rounded-2xl border border-dashed border-line p-5">
        <h2 className="text-base font-bold">With a card or bank transfer</h2>
        <p className="mt-1 text-sm text-muted">
          Coming soon: pay by card or bank transfer (including naira) and the dollars land straight in your Bursr wallet. No crypto app needed.
        </p>
      </section>
      )}
    </div>
  );
}
