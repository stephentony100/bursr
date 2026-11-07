import type { ActionOutcome, AgentAccount } from "./agent-account";
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

function samePayout(a: Payout, b: Payout) {
  return a.token.assetId === b.token.assetId && normaliseAddress(a.address) === normaliseAddress(b.address) && (a.memo ?? null) === (b.memo ?? null);
}

function refusedText(o: ActionOutcome): string | null {
  return o.status === "refused" ? `The account refused: ${o.refusal.message}` : null;
}

export async function payItem(
  db: PrismaClient,
  account: AgentAccount,
  item: PlanItemView,
  quote: typeof quotePayout = quotePayout,
): Promise<PlanItemView["payStatus"]> {
  const fail = async (payReason: string) => {
    await db.planItem.update({ where: { id: item.id }, data: { payStatus: "failed", payReason } });
    await db.auditEvent.create({ data: { kind: "payment_failed", actor: "agent", message: `${item.forWhat} to ${item.payeeName}: ${payReason}`, data: JSON.stringify({ itemId: item.id }) } });
    return "failed" as const;
  };

  const business = (await getBusiness(db))!;
  const planned = item.payout;
  if (!planned) return fail("No payee to pay.");
  const payee = (await listPayees(db)).find((p) => p.id === item.payeeId);
  if (!payee) return fail("The payee was removed after the plan was approved. Not paid.");
  if (!samePayout(payee.payout, planned)) return fail("The payee's payout details changed after the plan was approved. Not paid; it will come back in the next plan.");
  if (isOnPayoutHold(payee, new Date())) return fail("The payee's payout details changed recently and are on a 48-hour hold. Not paid.");

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
    if (swap.status === "accepted") references.push(swap.correlationId);
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
    data: { kind: "payment_sent", actor: "agent", message: `Sent ${item.forWhat} to ${item.payeeName}`, data: JSON.stringify({ itemId: item.id, references }) },
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
  const open = await db.plan.findMany({ where: { status: "approved" }, include: { items: true } });
  for (const p of open) {
    const done = p.items.filter((i) => i.placement === "in").every((i) => ["delivered", "failed", "refunded"].includes(i.payStatus));
    if (done) await db.plan.update({ where: { id: p.id }, data: { status: "done" } });
  }
}

