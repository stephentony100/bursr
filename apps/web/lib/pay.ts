import { agentAccount, type ActionOutcome, type AgentAccount } from "./agent-account";
import { readEnv } from "./env";
import { isOnPayoutHold, normaliseAddress, type Payout } from "./domain";
import type { PrismaClient } from "./generated/prisma/client";
import { getPlan, type PlanItemView } from "./plans";
import { amountOutFor, quotePayout } from "./quotes";
import { getBusiness, listPayees } from "./store";

// Pays an approved plan, item by item, through the agent account
// (lib/agent-account.ts). Bursar re-checks each item against the payee record
// as it is now; the account then applies the owner's signed rules and has the
// final say. Every request carries an idempotency key derived from the item,
// so retrying never pays twice. Agent-side code: it cannot change payees.

const MIN_SIM_DELIVERY_MS = 8_000;
const SETTLE_TIMEOUT_MS = 5 * 60_000;
const POLL_MS = 5_000;

/** Waits for an accepted action to reach a final state (live swaps take seconds to a minute). */
async function settle(account: AgentAccount, correlationId: string, timeoutMs = SETTLE_TIMEOUT_MS) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const o = await account.outcome(correlationId);
    if (o.state !== "pending" || Date.now() > until) return o;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

function samePayout(a: Payout, b: Payout) {
  return a.token.assetId === b.token.assetId && normaliseAddress(a.address) === normaliseAddress(b.address) && (a.memo ?? null) === (b.memo ?? null);
}

function refusedText(o: ActionOutcome): string | null {
  return o.status === "refused" ? `Blocked by your spending rules: ${o.refusal.message}` : null;
}

export async function payItem(
  db: PrismaClient,
  account: AgentAccount,
  item: PlanItemView,
  quote: typeof quotePayout = quotePayout,
): Promise<PlanItemView["payStatus"]> {
  const fail = async (payReason: string) => {
    await db.planItem.update({ where: { id: item.id }, data: { payStatus: "failed", payReason } });
    await db.auditEvent.create({ data: { kind: "payment_failed", actor: "agent", message: `Not paid: ${item.payeeName} (${item.forWhat}). ${payReason}`, data: JSON.stringify({ itemId: item.id }) } });
    return "failed" as const;
  };

  const business = (await getBusiness(db))!;
  const planned = item.payout;
  if (!planned) return fail("No payee to pay.");
  const payee =
    item.kind === "fee"
      ? business.rules.fee && { payout: business.rules.fee.payout, payoutChangedAt: null }
      : (await listPayees(db)).find((p) => p.id === item.payeeId);
  if (!payee) return fail(item.kind === "fee" ? "Bursar's fee was removed from your rules, so it wasn't paid." : "You removed this person after approving, so they weren't paid.");
  if (!samePayout(payee.payout, planned)) return fail("Their payment details changed after you approved, so they weren't paid. It will come back in next week's payments.");
  if (isOnPayoutHold(payee, new Date())) return fail("Their payment details changed recently and are on a 48-hour safety hold, so they weren't paid.");

  await db.planItem.update({ where: { id: item.id }, data: { payStatus: "paying" } });
  const treasury = business.rules.treasury;
  const token = planned.token;
  const amountOut = amountOutFor(item.amountUsd, token);
  const references: string[] = [];
  let amountSent = amountOut;

  if (token.assetId !== treasury.assetId) {
    // Different token: swap inside the account first, sized by a fresh quote.
    const q = await quote(treasury, planned, item.amountUsd);
    if (!q.ok) return fail(q.reason);
    amountSent = BigInt(q.quote.amountIn);
    const swap = await account.execute({ kind: "swap", asset: treasury.assetId, amount: amountSent, destinationAsset: token.assetId }, `${item.id}:swap`);
    const refused = refusedText(swap);
    if (refused) return fail(refused);
    if (swap.status === "accepted") {
      references.push(swap.correlationId);
      // "Only one money action runs per agent wallet at a time": wait for the swap before withdrawing.
      const o = await settle(account, swap.correlationId);
      if (o.state !== "done") {
        return fail(o.state === "pending" ? "The currency exchange was still running after 5 minutes. Check your Bursar wallet before paying again." : `The currency exchange didn't complete (${o.reason ?? o.state}). Nothing was sent to them.`);
      }
    }
  }

  const withdraw = await account.execute(
    { kind: "withdraw", asset: token.assetId, amount: amountOut, chain: token.chain, recipient: planned.address, memo: planned.memo },
    `${item.id}:withdraw`,
  );
  const refused = refusedText(withdraw);
  if (refused) return fail(refused);
  if (withdraw.status === "accepted") references.push(withdraw.correlationId);

  await db.planItem.update({
    where: { id: item.id },
    data: { payStatus: "sent", sentAt: new Date(), amountSent: amountSent.toString(), amountReceived: amountOut.toString(), references: JSON.stringify(references) },
  });
  await db.auditEvent.create({
    data: { kind: "payment_sent", actor: "agent", message: `Paid ${item.payeeName}: ${item.forWhat}`, data: JSON.stringify({ itemId: item.id, references }) },
  });
  return "sent";
}

/** Pays every item of an approved plan that has not been paid yet, one at a time. */
export async function payApprovedPlan(db: PrismaClient, account: AgentAccount, planId: string, quote: typeof quotePayout = quotePayout) {
  const plan = await getPlan(db, planId);
  if (!plan || plan.status === "draft") throw new Error("Only an approved plan can be paid.");
  const results: Record<string, string> = {};
  for (const item of plan.items) {
    if (item.placement !== "in" || item.payStatus !== "planned") continue;
    results[item.id] = await payItem(db, account, item, quote);
  }
  return results;
}

/**
 * Live mode: asks the account how each sent payment ended and records the
 * delivered amount and the payee-side transaction for the statement.
 */
export async function refreshLivePayments(db: PrismaClient, account: AgentAccount) {
  const sent = await db.planItem.findMany({ where: { payStatus: "sent" } });
  for (const i of sent) {
    const refs = JSON.parse(i.references) as string[];
    const last = [...refs].reverse().find((r) => !r.startsWith("sim_") && !r.startsWith("tx:"));
    if (!last) continue;
    const o = await account.outcome(last);
    if (o.state === "pending") continue;
    const next = o.state === "done" ? "delivered" : o.state === "refunded" ? "refunded" : "failed";
    await db.planItem.update({
      where: { id: i.id },
      data: {
        payStatus: next,
        payReason: o.state === "done" ? null : o.reason ?? null,
        amountReceived: o.amountOut !== undefined ? o.amountOut.toString() : i.amountReceived,
        references: JSON.stringify(o.txHash ? [...refs, `tx:${o.txHash}`] : refs),
      },
    });
  }
  await closeFinishedPlans(db);
}

async function closeFinishedPlans(db: PrismaClient) {
  const open = await db.plan.findMany({ where: { status: "approved" }, include: { items: true } });
  for (const p of open) {
    const done = p.items.filter((i) => i.placement === "in").every((i) => ["delivered", "failed", "refunded"].includes(i.payStatus));
    if (done) await db.plan.update({ where: { id: p.id }, data: { status: "done" } });
  }
}

/**
 * Practice mode: simulated payments move from "sent" to "delivered" after the
 * quote's time estimate (at least a few seconds), so the page shows the same
 * progression a live payment has. Live mode reads the real status (M4).
 */
export async function advanceSimulatedPayments(db: PrismaClient, now = new Date()) {
  const sent = await db.planItem.findMany({ where: { payStatus: "sent" } });
  for (const i of sent) {
    const refs = JSON.parse(i.references) as string[];
    if (!refs.every((r) => r.startsWith("sim_"))) continue;
    const est = i.quote ? Math.min((JSON.parse(i.quote) as { timeEstimateSec: number }).timeEstimateSec * 1000, 30_000) : 15_000;
    if (i.sentAt && now.getTime() - i.sentAt.getTime() >= Math.max(est, MIN_SIM_DELIVERY_MS)) {
      await db.planItem.update({ where: { id: i.id }, data: { payStatus: "delivered" } });
    }
  }
  await closeFinishedPlans(db);
}


/** Brings payment statuses up to date: simulated progress in practice mode, the account's real status in live mode. */
export async function refreshPayments(db: PrismaClient) {
  if (readEnv().BURSAR_MODE === "dry-run") return advanceSimulatedPayments(db);
  const pending = await db.planItem.count({ where: { payStatus: "sent" } });
  if (pending === 0) return;
  try {
    await refreshLivePayments(db, await agentAccount(db));
  } catch {
    // The page still renders with the last known status; the next visit tries again.
  }
}
