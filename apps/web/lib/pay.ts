import { agentAccount, type ActionOutcome, type AgentAccount } from "./agent-account";
import { readEnv } from "./env";
import { isOnPayoutHold, normaliseAddress, type Payout } from "./domain";
import type { PrismaClient } from "./generated/prisma/client";
import { canReceiveOnNear, notRegisteredText } from "./near-storage";
import { getPlan, type PlanItemView } from "./plans";
import { amountOutFor, quotePayout } from "./quotes";
import { getBusiness, listPayees } from "./store";
import { chainName } from "./tokens";

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
  if (o.status !== "refused") return null;
  return o.refusal.layer === "request"
    ? `The payment service didn't accept this request, so nothing was sent. Details: ${o.refusal.message}`
    : `Blocked by your spending rules: ${o.refusal.message}`;
}

/** Self-repair: why a payment didn't go out decides whether the agent waits and tries again, or hands it to the owner. */
type Problem =
  | { kind: "funds"; message: string } // not enough money in the Bursar wallet: retry when it arrives
  | { kind: "budget"; message: string; until: Date | null } // weekly limit used up: retry when it refills
  | { kind: "paused"; message: string } // owner paused payments: retry when they're back on
  | { kind: "payee"; message: string } // their NEAR account can't hold the token yet: check again daily
  | { kind: "transient"; message: string; definite: boolean } // network or service trouble: retry with backoff
  | { kind: "final"; message: string }; // needs the owner (removed payee, changed details, rule refusal)

const MINUTE = 60_000;
const BACKOFF_MIN = [1, 5, 15, 60, 180];
export const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

function problemFromRefusal(o: ActionOutcome & { status: "refused" }, weekResetsAt: Date | null): Problem {
  const text = refusedText(o)!;
  switch (o.refusal.code) {
    case "insufficient_balance":
      return { kind: "funds", message: "Not enough money in your Bursar wallet for this payment yet. I'll pay it as soon as you add money." };
    case "spend_budget_exceeded":
      return { kind: "budget", message: "Your weekly limit is used up. I'll pay it when the limit refills.", until: weekResetsAt };
    case "wallet_frozen":
      return { kind: "paused", message: "Payments are paused. I'll pay it when you turn them back on." };
    default:
      return o.refusal.layer === "request" ? { kind: "transient", message: text, definite: true } : { kind: "final", message: text };
  }
}

/** Where a payment stands after one try: paid, waiting for the agent's next try, or failed (the owner decides). */
export async function payItem(
  db: PrismaClient,
  account: AgentAccount,
  item: PlanItemView,
  quote: typeof quotePayout = quotePayout,
  now = new Date(),
): Promise<PlanItemView["payStatus"]> {
  const row = await db.planItem.findUnique({ where: { id: item.id }, select: { attempts: true } });
  const attempts = row?.attempts ?? 0;
  // Keys change only after a try that certainly sent nothing, so an unclear result is always replayed, never repeated.
  const key = (step: string) => (attempts === 0 ? `${item.id}:${step}` : `${item.id}:${step}:${attempts}`);

  const stop = async (p: Problem) => {
    const definite = p.kind !== "transient" || p.definite;
    const nextAttempts = definite ? attempts + 1 : attempts;
    const giveUp = p.kind === "final" || (p.kind === "transient" && nextAttempts >= MAX_ATTEMPTS);
    const retryAt =
      p.kind === "budget"
        ? (p.until ?? new Date(now.getTime() + 60 * MINUTE))
        : p.kind === "payee"
          ? new Date(now.getTime() + 24 * 60 * MINUTE)
          : p.kind === "transient"
            ? new Date(now.getTime() + BACKOFF_MIN[Math.min(nextAttempts, BACKOFF_MIN.length - 1)] * MINUTE)
            : new Date(now.getTime() + (p.kind === "funds" ? 2 : 10) * MINUTE);
    const status = giveUp ? ("failed" as const) : ("waiting" as const);
    const message = giveUp && p.kind === "transient" ? `I tried ${nextAttempts} times and it still didn't go through. ${p.message}` : p.message;
    await db.planItem.update({
      where: { id: item.id },
      data: { payStatus: status, payReason: message, payCode: p.kind, attempts: nextAttempts, retryAt: giveUp ? null : retryAt },
    });
    await db.auditEvent.create({
      data: {
        kind: giveUp ? "payment_failed" : "payment_waiting",
        actor: "agent",
        message: giveUp
          ? `Couldn't pay ${item.payeeName} (${item.forWhat}). ${message} This one needs you.`
          : `Waiting to pay ${item.payeeName} (${item.forWhat}). ${message}`,
        data: JSON.stringify({ itemId: item.id, problem: p.kind, retryAt: giveUp ? null : retryAt }),
      },
    });
    return status;
  };

  try {
    const business = (await getBusiness(db))!;
    const planned = item.payout;
    if (!planned) return stop({ kind: "final", message: "No payee to pay." });
    const payee =
      item.kind === "fee"
        ? business.rules.fee && { payout: business.rules.fee.payout, payoutChangedAt: null }
        : (await listPayees(db)).find((p) => p.id === item.payeeId);
    if (!payee) {
      return stop({ kind: "final", message: item.kind === "fee" ? "Bursar's fee was removed from your rules, so it wasn't paid." : "You removed this person, so they weren't paid." });
    }
    if (!samePayout(payee.payout, planned)) {
      return stop({ kind: "final", message: "Their payment details changed after this payment was set up, so it wasn't paid. It will come back with their new details." });
    }
    if (isOnPayoutHold(payee, now)) {
      return stop({ kind: "final", message: "Their payment details changed recently and are on a 48-hour safety hold, so they weren't paid." });
    }

    // A NEAR account must be registered with the token before it can receive it; check before swapping anything.
    if (account.backend === "agent-api" && planned.token.chain === "near") {
      const ok = await canReceiveOnNear(planned.token.assetId, planned.address);
      if (ok === false) return stop({ kind: "payee", message: `${notRegisteredText(planned.address, planned.token.symbol)} I'll check again every day.` });
    }

    await db.planItem.update({ where: { id: item.id }, data: { payStatus: "paying" } });
    const treasury = business.rules.treasury;
    const token = planned.token;
    const amountOut = amountOutFor(item.amountUsd, token);
    const references: string[] = [];
    let amountSent = amountOut;
    const status = account.backend === "agent-api" ? await account.status() : null;

    // Already holding enough of their currency (e.g. an earlier exchange whose send was refused):
    // send it without exchanging again, so a retry never buys twice or spends the weekly limit twice.
    const alreadyHeld = token.assetId !== treasury.assetId && status !== null && (status.balances[token.assetId] ?? 0n) >= amountOut;
    if (token.assetId !== treasury.assetId && !alreadyHeld) {
      // Different token: swap inside the account first, sized by a fresh quote.
      const q = await quote(treasury, planned, item.amountUsd);
      if (!q.ok) return stop({ kind: "transient", message: q.reason, definite: true });
      amountSent = BigInt(q.quote.amountIn);
      const swap = await account.execute({ kind: "swap", asset: treasury.assetId, amount: amountSent, destinationAsset: token.assetId }, key("swap"));
      if (swap.status === "refused") return stop(problemFromRefusal(swap, status?.weekResetsAt ?? null));
      references.push(swap.correlationId);
      // "Only one money action runs per agent wallet at a time": wait for the swap before withdrawing.
      const o = await settle(account, swap.correlationId);
      if (o.state === "pending") return stop({ kind: "transient", message: "The currency exchange is still running.", definite: false });
      if (o.state !== "done") {
        return stop({ kind: "transient", message: `The currency exchange didn't complete (${o.reason ?? o.state}). Nothing was sent to them.`, definite: true });
      }
    }

    const withdraw = await account.execute(
      { kind: "withdraw", asset: token.assetId, amount: amountOut, chain: token.chain, recipient: planned.address, memo: planned.memo },
      key("withdraw"),
    );
    if (withdraw.status === "refused") return stop(problemFromRefusal(withdraw, status?.weekResetsAt ?? null));
    references.push(withdraw.correlationId);

    await db.planItem.update({
      where: { id: item.id },
      data: {
        payStatus: "sent",
        payReason: null,
        payCode: null,
        retryAt: null,
        sentAt: now,
        amountSent: amountSent.toString(),
        amountReceived: amountOut.toString(),
        references: JSON.stringify(references),
      },
    });
    await db.auditEvent.create({
      data: {
        kind: "payment_sent",
        actor: "agent",
        message: `Sent ${item.payeeName} their ${item.forWhat.toLowerCase()}: ${token.symbol} on ${chainName(token.chain)}.`,
        data: JSON.stringify({ itemId: item.id, references }),
      },
    });
    return "sent";
  } catch (e) {
    // Network or service trouble: the result is unclear, so the next try replays the same keys.
    return stop({ kind: "transient", message: `I couldn't reach the payment service (${e instanceof Error ? e.message : String(e)}).`, definite: false });
  }
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
