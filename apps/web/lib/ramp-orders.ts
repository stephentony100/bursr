import { createHash } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client";
import { readEnv } from "./env";
import type { OwnerSession } from "./owner";
import { formatNgn, linqRamp, makePracticeRamp, RampError, type RampKind, type RampProvider } from "./ramp";
import { feeKeypair, hasUsdcTrustline, prepareCall, prepareGetTestUsdc, sc, StellarSimulationError, stellarConfig, submit, usdcBalance, waitForTx } from "./stellar";
import { assertStellarOwner } from "./stellar-owner";
import { refusalForVaultError } from "./stellar-vault";
import { getAccountRecord } from "./store";

// Naira orders for the Stellar edition (lib/ramp.ts is the provider).
// - Naira in: Bursr quotes, shows where to send the naira, and once paid the
//   USDC goes into the business's vault through its capped `deposit`.
// - Naira out: Bursr quotes and checks the bank account's name; the owner then
//   confirms one vault `owner_pay` to the provider's one-time address with
//   their passkey (lib/stellar-owner.ts kind "cash_out"); the provider pays the bank.
// In practice (testnet only) Bursr's test fee account plays the provider: it
// buys test USDC with test XLM to deliver, and receives cash-out USDC.

const USD_TO_STELLAR_UNITS = 10n; // micro-dollars (6) → Stellar USDC (7 decimals)

export interface RampOrderView {
  id: string;
  kind: RampKind;
  status: string;
  practice: boolean;
  usd: string;
  ngn: string;
  rate: string;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  reference: string | null;
  expiresAt: string;
  txHash: string | null;
}

/** Which provider this build uses, or null when naira isn't available here (mainnet before Linq is connected). */
export function rampProvider(): RampProvider | null {
  const env = readEnv();
  if (env.LINQ_MODE === "live") return linqRamp;
  if (stellarConfig().network.name !== "testnet") return null;
  return makePracticeRamp(() => feeKeypair().publicKey());
}

function view(o: { id: string; kind: string; status: string; provider: string; usdMicros: string; ngnKobo: string; koboPerUsd: string; bankName: string | null; accountNumber: string | null; accountName: string | null; reference: string | null; expiresAt: Date; txHash: string | null }): RampOrderView {
  const usd = BigInt(o.usdMicros);
  return {
    id: o.id,
    kind: o.kind as RampKind,
    status: o.status,
    practice: o.provider === "practice",
    usd: `$${(usd / 1_000_000n).toString()}.${(usd % 1_000_000n).toString().padStart(6, "0").slice(0, 2)}`,
    ngn: formatNgn(BigInt(o.ngnKobo)),
    rate: `${formatNgn(BigInt(o.koboPerUsd))} per $1`,
    bankName: o.bankName,
    accountNumber: o.accountNumber,
    accountName: o.accountName,
    reference: o.reference,
    expiresAt: o.expiresAt.toISOString(),
    txHash: o.txHash,
  };
}

async function vaultFor(db: PrismaClient): Promise<string> {
  const record = await getAccountRecord(db);
  if (!record || record.backend !== "stellar") throw new RampError("Set up your Bursr wallet first.");
  return record.agentId;
}

function need(): RampProvider {
  const p = rampProvider();
  if (!p) throw new RampError("Adding and cashing out naira is coming soon here.");
  return p;
}

/** Naira in, step 1: a quote and where to send the naira. */
export async function startNairaIn(db: PrismaClient, owner: OwnerSession, usdMicros: bigint): Promise<RampOrderView> {
  await assertStellarOwner(db, owner);
  const vault = await vaultFor(db);
  const provider = need();
  const q = await provider.quote("on", usdMicros);
  const order = await db.rampOrder.create({
    data: { kind: "on", provider: provider.name, status: "awaiting_payment", usdMicros: usdMicros.toString(), ngnKobo: q.ngnKobo.toString(), koboPerUsd: q.koboPerUsd.toString(), expiresAt: q.expiresAt },
  });
  const bank = await provider.startOnRamp({ orderId: order.id, usdMicros, ngnKobo: q.ngnKobo, deliverTo: vault });
  return view(await db.rampOrder.update({ where: { id: order.id }, data: { bankName: bank.bankName, accountNumber: bank.accountNumber, accountName: bank.accountName, reference: bank.reference } }));
}

/**
 * Naira in, step 2 (practice): the owner says they've sent the naira; the
 * practice provider delivers test USDC into the vault. With Linq, delivery
 * arrives by webhook instead.
 */
export async function finishPracticeNairaIn(db: PrismaClient, owner: OwnerSession, orderId: string): Promise<RampOrderView> {
  await assertStellarOwner(db, owner);
  const vault = await vaultFor(db);
  const order = await db.rampOrder.findFirst({ where: { id: orderId, kind: "on" } });
  if (!order) throw new RampError("That order wasn't found.");
  if (order.status === "done") return view(order);
  if (order.provider !== "practice") throw new RampError("Your money arrives as soon as the bank transfer reaches Linq.");
  if (order.status !== "awaiting_payment") throw new RampError("This order is already being delivered.");
  if (order.expiresAt < new Date()) {
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "expired" } });
    throw new RampError("This quote ran out of time. Start again for a fresh one.");
  }
  // Claim the order first, so a second tap can't deliver twice.
  const claimed = await db.rampOrder.updateMany({ where: { id: order.id, status: "awaiting_payment" }, data: { status: "paying" } });
  if (claimed.count !== 1) throw new RampError("This order is already being delivered.");
  try {
    const amount = BigInt(order.usdMicros) * USD_TO_STELLAR_UNITS;
    await practiceFeeHasUsdc(amount);
    const fee = feeKeypair();
    let tx;
    try {
      tx = await prepareCall(fee.publicKey(), vault, "deposit", [sc.address(fee.publicKey()), sc.i128(amount)]);
    } catch (e) {
      if (e instanceof StellarSimulationError && e.contractError !== null) throw new RampError(refusalForVaultError(e.contractError).message);
      throw e;
    }
    tx.sign(fee);
    const r = await waitForTx(await submit(tx), 40);
    if (r.state !== "done") throw new RampError("Stellar is slow to confirm. Check your wallet again in a minute.");
    const done = await db.rampOrder.update({ where: { id: order.id }, data: { status: "done", txHash: r.hash } });
    await db.auditEvent.create({ data: { kind: "ramp_on", actor: owner.accountId, message: `You added ${view(done).usd} from naira (practice)`, data: JSON.stringify({ orderId: order.id, txHash: r.hash }) } });
    return view(done);
  } catch (e) {
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "awaiting_payment" } });
    throw e;
  }
}

/** Practice only: the test fee account holds enough test USDC, buying the rest with its test XLM. */
async function practiceFeeHasUsdc(amount: bigint): Promise<void> {
  const fee = feeKeypair();
  const held = (await hasUsdcTrustline(fee.publicKey())) ? await usdcBalance(fee.publicKey()) : 0n;
  if (held >= amount) return;
  const { tx } = await prepareGetTestUsdc(fee.publicKey(), amount - held + 1_000_000n);
  tx.sign(fee);
  const r = await waitForTx(await submit(tx), 40);
  if (r.state !== "done") throw new RampError("The practice exchange didn't fill. Please try again in a minute.");
  if ((await usdcBalance(fee.publicKey())) < amount) throw new RampError("The practice exchange is short of test USDC right now. Try a smaller amount.");
}

/** Naira out, step 1: a quote, the bank account's name, and where the vault will pay. The owner confirms next. */
export async function startNairaOut(db: PrismaClient, owner: OwnerSession, usdMicros: bigint, bankName: string, accountNumber: string): Promise<RampOrderView> {
  await assertStellarOwner(db, owner);
  await vaultFor(db);
  const provider = need();
  if (!bankName.trim()) throw new RampError("Pick your bank.");
  const accountName = await provider.accountName(bankName, accountNumber);
  const q = await provider.quote("off", usdMicros);
  if (provider.name === "practice" && !(await hasUsdcTrustline(feeKeypair().publicKey()))) await practiceFeeHasUsdc(1n);
  const bank = { bankName: bankName.trim(), accountNumber, accountName };
  const order = await db.rampOrder.create({
    data: { kind: "off", provider: provider.name, status: "quoted", usdMicros: usdMicros.toString(), ngnKobo: q.ngnKobo.toString(), koboPerUsd: q.koboPerUsd.toString(), expiresAt: q.expiresAt, ...bank },
  });
  const { depositAddress } = await provider.startOffRamp({ orderId: order.id, usdMicros, ngnKobo: q.ngnKobo, bank });
  return view(await db.rampOrder.update({ where: { id: order.id }, data: { depositAddress } }));
}

/** The vault payment for a cash-out order: its payment key (so it's paid once), address and amount. */
export async function cashOutPayment(db: PrismaClient, orderId: string): Promise<{ key: Buffer; to: string; amount: bigint }> {
  const order = await db.rampOrder.findFirst({ where: { id: orderId, kind: "off" } });
  if (!order || !order.depositAddress) throw new RampError("That cash-out wasn't found. Start again.");
  if (order.status !== "quoted") throw new RampError(order.status === "done" ? "This cash-out is already paid." : "This cash-out is already on its way.");
  if (order.expiresAt < new Date()) {
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "expired" } });
    throw new RampError("This quote ran out of time. Start again for a fresh one.");
  }
  return { key: rampPaymentKey(order.id), to: order.depositAddress, amount: BigInt(order.usdMicros) * USD_TO_STELLAR_UNITS };
}

/** After the owner's confirmed vault payment landed: practice is done at once; Linq confirms the bank payout by webhook. */
export async function cashOutSent(db: PrismaClient, owner: OwnerSession, orderId: string, txHash: string): Promise<void> {
  const order = await db.rampOrder.findFirst({ where: { id: orderId, kind: "off" } });
  if (!order) return;
  const done = await db.rampOrder.update({ where: { id: order.id }, data: { status: order.provider === "practice" ? "done" : "paying", txHash } });
  await db.auditEvent.create({
    data: { kind: "ramp_off", actor: owner.accountId, message: `You cashed out ${view(done).usd} (${view(done).ngn}) to ${order.accountName ?? "your bank"}${order.provider === "practice" ? " (practice)" : ""}`, data: JSON.stringify({ orderId, txHash }) },
  });
}

export function rampPaymentKey(orderId: string): Buffer {
  return createHash("sha256").update(`ramp:${orderId}`).digest();
}

export async function rampOrderView(db: PrismaClient, orderId: string): Promise<RampOrderView | null> {
  const o = await db.rampOrder.findFirst({ where: { id: orderId } });
  return o ? view(o) : null;
}
