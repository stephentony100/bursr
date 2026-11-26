import { createHash } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client";
import { readEnv } from "./env";
import type { OwnerSession } from "./owner";
import { linqFromEnv } from "./linq";
import { formatNgn, makeLinqRamp, makePracticeRamp, NIGERIAN_BANKS, PRACTICE_BANK, RampError, type RampKind, type RampProvider } from "./ramp";
import { ensureFeeUsdcTrustline, feeKeypair, hasUsdcTrustline, prepareCall, prepareGetTestUsdc, sc, StellarSimulationError, stellarConfig, submit, usdcBalance, waitForTx } from "./stellar";
import { assertStellarOwner } from "./stellar-owner";
import { refusalForVaultError, VAULT_MAX_BALANCE } from "./stellar-vault";
import { getAccountRecord, getBusiness } from "./store";

// Naira orders for the Stellar edition (lib/ramp.ts is the provider).
// - Naira in: Bursr quotes, shows where to send the naira, and once paid the
//   USDC goes into the business's vault through its capped `deposit`.
// - Naira out: Bursr quotes and checks the bank account's name; the owner then
//   confirms one vault `owner_pay` to the provider's one-time address with
//   their passkey (lib/stellar-owner.ts kind "cash_out"); the provider pays the bank.
// In practice (testnet only) Bursr's test fee account plays the provider: it
// buys test USDC with test XLM to deliver, and receives cash-out USDC.
// With Linq (mainnet only, real money): cash-out only for now. Linq refunds a
// failed payout to Bursr's fee account (a business's vault is a contract Linq
// can't refund to), and Bursr puts it back into that business's vault.

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
  /** Naira in: the provider's fee on top of `ngn`, if any. */
  fee: string | null;
  expiresAt: string;
  txHash: string | null;
}

/** Micro-dollars as "$12.34" (cents, rounded down). */
function usdText(micros: bigint): string {
  return `$${(micros / 1_000_000n).toString()}.${(micros % 1_000_000n).toString().padStart(6, "0").slice(0, 2)}`;
}

/** Which provider this build uses, or null when naira isn't available here. Linq is mainnet only; practice is testnet only. */
export function rampProvider(): RampProvider | null {
  const env = readEnv();
  const net = stellarConfig().network.name;
  if (env.LINQ_MODE === "live") return net === "mainnet" && env.LINQ_BASE_URL && env.LINQ_API_KEY ? makeLinqRamp(linqFromEnv()) : null;
  return net === "testnet" ? makePracticeRamp(() => feeKeypair().publicKey()) : null;
}

function view(o: { id: string; kind: string; status: string; provider: string; usdMicros: string; ngnKobo: string; koboPerUsd: string; bankName: string | null; accountNumber: string | null; accountName: string | null; reference: string | null; feeKobo?: string | null; expiresAt: Date; txHash: string | null }): RampOrderView {
  const usd = BigInt(o.usdMicros);
  return {
    id: o.id,
    kind: o.kind as RampKind,
    status: o.status,
    practice: o.provider === "practice",
    usd: usdText(usd),
    ngn: formatNgn(BigInt(o.ngnKobo)),
    rate: `${formatNgn(BigInt(o.koboPerUsd))} per $1`,
    bankName: o.bankName,
    accountNumber: o.accountNumber,
    accountName: o.accountName,
    reference: o.reference,
    fee: o.feeKobo && o.feeKobo !== "0" ? formatNgn(BigInt(o.feeKobo)) : null,
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
  const business = await getBusiness(db);
  const provider = need();
  const customerRef = business?.id ?? "main";
  if (provider.name === "linq") {
    const person = await db.rampCustomer.findFirst({});
    if (!person?.verified) throw new RampError("Verify your details first, so Linq can take naira from you.");
    // The vault holds at most its cap: refuse an order that would go over it.
    const room = VAULT_MAX_BALANCE - (await usdcBalance(vault));
    if (usdMicros * USD_TO_STELLAR_UNITS > room) throw new RampError(`Your Bursr wallet can take up to ${usdText(room > 0n ? room / USD_TO_STELLAR_UNITS : 0n)} more right now.`);
  }
  const q = await provider.quote("on", usdMicros);
  // Linq sends USDC to a Stellar account (G…). Unless it can pay the vault (a contract) directly, it pays Bursr's
  // fee account, and Bursr deposits the USDC into the vault as soon as it arrives (completeNairaIn).
  const deliverTo = provider.name === "linq" && readEnv().LINQ_ONRAMP_DELIVER_TO === "fee_account" ? await ensureFeeUsdcTrustline() : vault;
  const order = await db.rampOrder.create({
    data: { kind: "on", provider: provider.name, status: "awaiting_payment", usdMicros: usdMicros.toString(), ngnKobo: q.ngnKobo.toString(), koboPerUsd: q.koboPerUsd.toString(), expiresAt: q.expiresAt, deliverTo },
  });
  try {
    const bank = await provider.startOnRamp({ orderId: order.id, usdMicros, ngnKobo: q.ngnKobo, deliverTo, customerRef });
    return view(
      await db.rampOrder.update({
        where: { id: order.id },
        data: {
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          accountName: bank.accountName,
          reference: bank.reference,
          providerOrderId: bank.providerOrderId,
          ngnKobo: bank.ngnKobo.toString(),
          feeKobo: bank.feeKobo.toString(),
          ...(bank.expiresAt ? { expiresAt: bank.expiresAt } : {}),
        },
      }),
    );
  } catch (e) {
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "failed" } });
    throw e;
  }
}

// --- The person behind a business, for Linq naira in ---

export interface RampPersonView {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  verified: boolean;
}

export async function rampPerson(db: PrismaClient): Promise<RampPersonView | null> {
  const p = await db.rampCustomer.findFirst({});
  return p ? { firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone, verified: p.verified } : null;
}

/**
 * Registers the business's person with Linq and verifies their NIN, once.
 * The NIN goes to Linq only; Bursr keeps the name, email, phone and whether
 * they are verified.
 */
export async function verifyForNaira(db: PrismaClient, owner: OwnerSession, p: { firstName: string; lastName: string; email: string; phone: string; nin: string }): Promise<RampPersonView> {
  await assertStellarOwner(db, owner);
  const business = await getBusiness(db);
  if (readEnv().LINQ_MODE !== "live") throw new RampError("Verification is only needed for real naira. Practice needs none.");
  const person = { firstName: p.firstName.trim(), lastName: p.lastName.trim(), email: p.email.trim(), phone: p.phone.replace(/\s+/g, "") };
  if (!person.firstName || !person.lastName) throw new RampError("Enter your first and last name as on your ID.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(person.email)) throw new RampError("Enter a real email address.");
  if (!/^(\+?234|0)\d{10}$/.test(person.phone)) throw new RampError("Enter a Nigerian phone number, like 08012345678.");
  if (!/^\d{11}$/.test(p.nin.trim())) throw new RampError("Your NIN has 11 digits.");
  const linq = linqFromEnv();
  const customerRef = business?.id ?? "main";
  await linq.provisionCustomer({ customerRef, ...person });
  const verified = await linq.submitKyc(customerRef, p.nin.trim());
  const existing = await db.rampCustomer.findFirst({});
  const data = { provider: "linq", ...person, verified, verifiedAt: verified ? new Date() : null };
  if (existing) await db.rampCustomer.update({ where: { id: existing.id }, data });
  else await db.rampCustomer.create({ data });
  await db.auditEvent.create({ data: { kind: "ramp_verify", actor: owner.accountId, message: verified ? "You verified your details for naira with Linq" : "Linq couldn't verify your details yet", data: JSON.stringify({ verified }) } });
  if (!verified) throw new RampError("Linq couldn't verify that NIN. Check it matches your name and try again.");
  return (await rampPerson(db))!;
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

/** Naira out, step 1: the bank account's name, the provider's order (locked amounts) and where the vault will pay. The owner confirms next. */
export async function startNairaOut(db: PrismaClient, owner: OwnerSession, usdMicros: bigint, bankCode: string, accountNumber: string): Promise<RampOrderView> {
  await assertStellarOwner(db, owner);
  await vaultFor(db);
  const business = await getBusiness(db);
  const provider = need();
  const bankEntry = [...NIGERIAN_BANKS, ...(provider.name === "practice" ? [PRACTICE_BANK] : [])].find((b) => b.code === bankCode);
  if (!bankEntry) throw new RampError("Pick your bank.");
  const accountName = await provider.accountName(bankEntry.code, accountNumber);
  const q = await provider.quote("off", usdMicros);
  // Practice cash-outs land in the fee account, and Linq refunds there: it needs a USDC trustline either way.
  const refundAddress = await ensureFeeUsdcTrustline();
  const bank = { bankCode: bankEntry.code, bankName: bankEntry.name, accountNumber, accountName };
  const order = await db.rampOrder.create({
    data: { kind: "off", provider: provider.name, status: "quoted", usdMicros: usdMicros.toString(), ngnKobo: q.ngnKobo.toString(), koboPerUsd: q.koboPerUsd.toString(), expiresAt: q.expiresAt, ...bank },
  });
  try {
    const placed = await provider.startOffRamp({ orderId: order.id, usdMicros, ngnKobo: q.ngnKobo, bank, customerRef: business?.id ?? "main", refundAddress });
    return view(
      await db.rampOrder.update({
        where: { id: order.id },
        data: { depositAddress: placed.depositAddress, providerOrderId: placed.providerOrderId, usdMicros: placed.usdMicros.toString(), ngnKobo: placed.ngnKobo.toString(), koboPerUsd: placed.koboPerUsd.toString() },
      }),
    );
  } catch (e) {
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "failed" } });
    throw e;
  }
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
  if (rampProvider()?.name === "linq") await refreshLinqOrders(db).catch((e) => console.error("[bursar] Linq refresh", e));
  const o = await db.rampOrder.findFirst({ where: { id: orderId } });
  return o ? view(o) : null;
}

// --- Linq updates (webhook and status checks) ---

/** Linq's order status words to Bursr's (docs: "Order statuses"; the webhook's order.* events). */
export function linqStatusToOrder(status: string, event?: string): "paying" | "done" | "failed" | null {
  if (event === "order.completed" || status === "disbursed" || status === "Settled in treasury") return "done";
  if (event === "order.failed" || status === "failed" || status.startsWith("timeout")) return "failed";
  if (event === "order.processing" || status.startsWith("processing") || status === "initiated") return "paying";
  return null;
}

/**
 * Applies a Linq update to Bursr's order, found by Linq's order id across all
 * businesses (`db` must be the unscoped client). Idempotent. A failure after
 * the vault already paid means Linq refunds the USDC to Bursr's fee account:
 * the order waits as "refund_pending" until Bursr returns it (returnRefunds).
 */
export async function applyLinqUpdate(db: PrismaClient, linqOrderId: string, status: string, event?: string): Promise<void> {
  const order = await db.rampOrder.findUnique({ where: { providerOrderId: linqOrderId } });
  if (!order || order.kind !== "off" || ["done", "refunded", "refund_pending", "refunding"].includes(order.status)) return;
  const next = linqStatusToOrder(status, event);
  if (!next || next === order.status) return;
  const final = next === "failed" && order.txHash ? "refund_pending" : next;
  await db.rampOrder.update({ where: { id: order.id }, data: { status: final } });
  const words =
    final === "done"
      ? `${formatNgn(BigInt(order.ngnKobo))} reached ${order.accountName ?? "your bank"}`
      : final === "refund_pending"
        ? "Your bank payout failed. Linq is returning the USDC, and Bursr will put it back in your Bursr wallet"
        : final === "failed"
          ? "This cash-out didn't go through. No money left your Bursr wallet"
          : null;
  if (words) await db.auditEvent.create({ data: { businessId: order.businessId, kind: "ramp_off_update", actor: "linq", message: words, data: JSON.stringify({ orderId: order.id, linqOrderId, status }) } });
}

/** Linq's naira-in statuses (docs: "Onramp order status values"; `completed` is "the only success value"). */
export function linqOnrampStatusToOrder(status: string, event?: string): "done" | "failed" | "paying" | null {
  if (event === "order.completed" || status === "completed") return "done";
  if (event === "order.failed" || status === "failed" || status === "expired" || status === "fiat refunded") return "failed";
  if (status === "fiat received" || status.startsWith("processing") || status === "crypto confirmed") return "paying";
  return null;
}

/**
 * Applies a Linq naira-in update (unscoped `db`). On success the USDC is
 * either in the vault already, or in Bursr's fee account, from where Bursr
 * deposits it into the vault (status `delivering` → `done`).
 */
export async function applyLinqOnrampUpdate(db: PrismaClient, linqOrderId: string, status: string, event?: string): Promise<void> {
  const order = await db.rampOrder.findUnique({ where: { providerOrderId: linqOrderId } });
  if (!order || order.kind !== "on" || ["done", "failed", "delivering"].includes(order.status)) return;
  const next = linqOnrampStatusToOrder(status, event);
  if (!next || next === order.status) return;
  if (next === "done") {
    await deliverNairaIn(db, order.id);
    return;
  }
  await db.rampOrder.update({ where: { id: order.id }, data: { status: next } });
  if (next === "failed") await db.auditEvent.create({ data: { businessId: order.businessId, kind: "ramp_on_update", actor: "linq", message: "Your naira deposit didn't complete. If you sent the naira, Linq returns it to your bank", data: JSON.stringify({ orderId: order.id, linqOrderId, status }) } });
}

/** Puts a completed naira-in into the vault: nothing to do if Linq paid the vault, else a deposit from Bursr's fee account. Idempotent. */
export async function deliverNairaIn(db: PrismaClient, orderId: string): Promise<void> {
  const order = await db.rampOrder.findUnique({ where: { id: orderId } });
  if (!order || order.status === "done") return;
  const record = await db.agentAccount.findFirst({ where: { id: order.businessId, backend: "stellar" } });
  if (!record) return;
  const finish = async (txHash: string | null) => {
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "done", ...(txHash ? { txHash } : {}) } });
    await db.auditEvent.create({ data: { businessId: order.businessId, kind: "ramp_on", actor: "linq", message: `${view(order).usd} from naira is in your Bursr wallet`, data: JSON.stringify({ orderId: order.id, txHash }) } });
  };
  if (order.deliverTo === record.agentId) return finish(null);
  // Claim first, so two updates can't deposit twice.
  const claimed = await db.rampOrder.updateMany({ where: { id: order.id, status: { in: ["awaiting_payment", "paying"] } }, data: { status: "delivering" } });
  if (claimed.count !== 1) return;
  const fee = feeKeypair();
  const amount = BigInt(order.usdMicros) * USD_TO_STELLAR_UNITS;
  try {
    if ((await usdcBalance(fee.publicKey())) < amount) throw new Error("not arrived yet");
    const tx = await prepareCall(fee.publicKey(), record.agentId, "deposit", [sc.address(fee.publicKey()), sc.i128(amount)]);
    tx.sign(fee);
    const r = await waitForTx(await submit(tx), 40);
    if (r.state !== "done") throw new Error(r.state);
    await finish(r.hash);
  } catch (e) {
    console.error("[bursar] delivering naira-in", e);
    await db.rampOrder.update({ where: { id: order.id }, data: { status: "paying" } }); // retried by the next status check
  }
}

/** Status check fallback (Linq tries each webhook once): asks Linq about naira orders still open, then returns any refunds. */
export async function refreshLinqOrders(db: PrismaClient): Promise<void> {
  const incoming = await db.rampOrder.findMany({ where: { provider: "linq", kind: "on", status: { in: ["awaiting_payment", "paying"] }, providerOrderId: { not: null } } });
  if (incoming.length > 0) {
    const linq = linqFromEnv();
    for (const o of incoming) {
      try {
        const st = await linq.onrampStatus(o.businessId, o.providerOrderId!);
        await applyLinqOnrampUpdate(db, o.providerOrderId!, st.status);
      } catch (e) {
        console.error("[bursar] Linq naira-in status check", e);
      }
    }
  }
  const open = await db.rampOrder.findMany({ where: { provider: "linq", kind: "off", status: "paying", providerOrderId: { not: null } } });
  if (open.length > 0) {
    const linq = linqFromEnv();
    for (const o of open) {
      try {
        const st = await linq.status(o.providerOrderId!);
        await applyLinqUpdate(db, o.providerOrderId!, st.status);
      } catch (e) {
        console.error("[bursar] Linq status check", e);
      }
    }
  }
  await returnRefunds(db);
}

/** Puts refunded USDC (back in Bursr's fee account) into each waiting business's vault, oldest first, while the fee account holds enough. */
export async function returnRefunds(db: PrismaClient): Promise<void> {
  const waiting = await db.rampOrder.findMany({ where: { status: "refund_pending" }, orderBy: { createdAt: "asc" } });
  if (waiting.length === 0) return;
  const fee = feeKeypair();
  for (const o of waiting) {
    const amount = BigInt(o.usdMicros) * USD_TO_STELLAR_UNITS;
    if ((await usdcBalance(fee.publicKey())) < amount) return; // not arrived yet
    const record = await db.agentAccount.findFirst({ where: { id: o.businessId, backend: "stellar" } });
    if (!record) continue;
    // Claim first, so two checks can't return it twice.
    const claimed = await db.rampOrder.updateMany({ where: { id: o.id, status: "refund_pending" }, data: { status: "refunding" } });
    if (claimed.count !== 1) continue;
    try {
      const tx = await prepareCall(fee.publicKey(), record.agentId, "deposit", [sc.address(fee.publicKey()), sc.i128(amount)]);
      tx.sign(fee);
      const r = await waitForTx(await submit(tx), 40);
      if (r.state !== "done") throw new Error(r.state);
      await db.rampOrder.update({ where: { id: o.id }, data: { status: "refunded" } });
      await db.auditEvent.create({ data: { businessId: o.businessId, kind: "ramp_off_refunded", actor: "bursr", message: `${view(o).usd} from a failed cash-out is back in your Bursr wallet`, data: JSON.stringify({ orderId: o.id, txHash: r.hash }) } });
    } catch (e) {
      console.error("[bursar] returning a Linq refund", e);
      await db.rampOrder.update({ where: { id: o.id }, data: { status: "refund_pending" } });
    }
  }
}
