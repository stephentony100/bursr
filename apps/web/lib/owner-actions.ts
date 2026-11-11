import type { Policy } from "@near-intents-agent-api/sdk";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { normaliseAddress, PayoutSchema, PriceItemSchema, RulesSchema, type Payee, type Payout, type PriceItem, type Rules } from "./domain";
import { addressProblem } from "./address";
import type { PrismaClient } from "./generated/prisma/client";
import { isOwnerSession, type OwnerSession } from "./owner";
import { formatUsd } from "./money";
import { buildPolicy } from "./policy";
import { getAccountRecord, getBusiness, getPayee, listPayees } from "./store";

// Everything that changes the owner's rules or payees. Each function needs an
// OwnerSession (lib/owner.ts), and the session must belong to the business's
// owner. The agent side of Bursar has no way to call these (see
// lib/boundaries.test.ts), and in live mode nothing here takes effect on the
// account until the owner signs the new policy with their wallet.

export class NotOwnerError extends Error {
  constructor(message = "Only the owner can do this.") {
    super(message);
    this.name = "NotOwnerError";
  }
}

async function assertOwner(db: PrismaClient, owner: OwnerSession) {
  if (!isOwnerSession(owner)) throw new NotOwnerError();
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");
  if (business.ownerAccountId !== owner.accountId) throw new NotOwnerError();
  return business;
}

async function audit(db: PrismaClient, owner: OwnerSession, kind: string, message: string, data?: unknown) {
  await db.auditEvent.create({
    data: { kind, actor: owner.accountId, message, data: data === undefined ? null : JSON.stringify(data) },
  });
}

/** The policy the owner's current rules and payees call for. */
export async function desiredPolicy(db: PrismaClient): Promise<Policy | null> {
  const business = await getBusiness(db);
  if (!business) return null;
  return buildPolicy(business.rules, await listPayees(db));
}

/** Live mode: true when rules or payees changed since the owner last signed. */
export async function policyNeedsSigning(db: PrismaClient): Promise<boolean> {
  const [want, have] = await Promise.all([desiredPolicy(db), getAccountRecord(db)]);
  if (!want || !have) return false;
  return !isDeepStrictEqual(want, have.policy);
}

/**
 * Dry-run only: the demo owner's change is applied to the simulated account at
 * once. Live mode never calls this; the signed policy comes back from the
 * Agent API (lib/agent-account/owner-intents.ts).
 */
async function applyToSimulatedAccount(db: PrismaClient) {
  const account = await getAccountRecord(db);
  const policy = await desiredPolicy(db);
  if (!account || account.backend !== "simulated" || !policy) return;
  if (isDeepStrictEqual(policy, account.policy)) return;
  await db.agentAccount.update({
    where: { id: "main" },
    data: { policy: JSON.stringify(policy), policyRevision: { increment: 1 }, signedAt: new Date() },
  });
}

export interface SetupInput {
  name: string;
  rules: Rules;
  /** Dry-run only: demo funds placed in the simulated account, per asset id. */
  demoBalances?: Record<string, bigint>;
}

/** First run: the signed-in owner becomes the owner of this business. */
export async function setupBusiness(db: PrismaClient, owner: OwnerSession, input: SetupInput) {
  if (!isOwnerSession(owner)) throw new NotOwnerError();
  const rules = RulesSchema.parse(input.rules);
  const existing = await getBusiness(db);
  if (existing && existing.ownerAccountId !== owner.accountId) throw new NotOwnerError("This business already has an owner.");
  await db.business.upsert({
    where: { id: "main" },
    create: { name: input.name, ownerAccountId: owner.accountId, rules: JSON.stringify(rules) },
    update: { name: input.name, rules: JSON.stringify(rules) },
  });
  if (owner.demo) {
    const policy = buildPolicy(rules, await listPayees(db));
    const balances = Object.fromEntries(Object.entries(input.demoBalances ?? {}).map(([k, v]) => [k, v.toString()]));
    await db.agentAccount.upsert({
      where: { id: "main" },
      create: { backend: "simulated", agentId: "dry-run", policy: JSON.stringify(policy), simBalances: JSON.stringify(balances) },
      update: {},
    });
  }
  await audit(db, owner, "business_setup", `Welcome to Bursar, ${input.name}`, rules);
}

export async function updateRules(db: PrismaClient, owner: OwnerSession, rules: Rules) {
  await assertOwner(db, owner);
  const parsed = RulesSchema.parse(rules);
  await db.business.update({ where: { id: "main" }, data: { rules: JSON.stringify(parsed) } });
  await audit(db, owner, "rules_changed", "You updated your spending rules", parsed);
  await applyToSimulatedAccount(db);
}

export async function setFrozen(db: PrismaClient, owner: OwnerSession, frozen: boolean) {
  const business = await assertOwner(db, owner);
  await updateRules(db, owner, { ...business.rules, frozen });
  await audit(db, owner, frozen ? "account_frozen" : "account_unfrozen", frozen ? "You paused all payments" : "You turned payments back on");
}

export interface PayeeInput {
  name: string;
  category: Payee["category"];
  payout: Payout;
  prices: PriceItem[];
  recurring: Payee["recurring"];
}

function cleanPayout(rules: Rules, payout: Payout): Payout {
  const p = PayoutSchema.parse(payout);
  if (!rules.payoutTokens.some((t) => t.assetId === p.token.assetId)) {
    throw new Error(`${p.token.symbol} on ${p.token.chain} is not one of the tokens the rules allow.`);
  }
  const problem = addressProblem(p.token.chain, p.address);
  if (problem) throw new Error(problem);
  return { ...p, address: normaliseAddress(p.address), memo: p.memo?.trim() || null };
}

/** The agent's wallet holds at most 256 payout addresses ("The list holds up to 256 entries": Agent API policies-and-limits). */
export const MAX_ADDRESSES = 256;

/** How many different payout addresses the wallet's list would hold with these people added (shared addresses count once). */
export async function addressesWith(db: PrismaClient, rules: Rules, extra: Payout[]): Promise<number> {
  const payees = await listPayees(db);
  const added = extra.map((payout, i) => ({ ...payees[0], id: `new-${i}`, payout }) as Payee);
  return buildPolicy(rules, [...payees, ...added]).destinations.list.length;
}

function tooManyText(count: number) {
  return `Your agent's wallet can hold up to ${MAX_ADDRESSES} different payout addresses, and this would make ${count}. Remove people you no longer pay first.`;
}

export async function addPayee(db: PrismaClient, owner: OwnerSession, input: PayeeInput): Promise<string> {
  const business = await assertOwner(db, owner);
  const payout = cleanPayout(business.rules, input.payout);
  const count = await addressesWith(db, business.rules, [payout]);
  if (count > MAX_ADDRESSES) throw new Error(tooManyText(count));
  const row = await db.payee.create({
    data: {
      name: input.name.trim(),
      category: input.category,
      payout: JSON.stringify(payout),
      prices: JSON.stringify(input.prices.map((p) => PriceItemSchema.parse(p))),
      recurring: JSON.stringify(input.recurring),
    },
  });
  await audit(db, owner, "payee_added", `You added ${input.name}`, { id: row.id, payout });
  await applyToSimulatedAccount(db);
  return row.id;
}

/** A list checked row by row (e.g. a spreadsheet): all are added, or none if any row has a problem. */
export async function addPayees(db: PrismaClient, owner: OwnerSession, inputs: PayeeInput[]): Promise<string[]> {
  const business = await assertOwner(db, owner);
  if (inputs.length === 0) throw new Error("There's nobody to add.");
  const clean = inputs.map((input) => ({ ...input, name: input.name.trim(), payout: cleanPayout(business.rules, input.payout) }));
  const count = await addressesWith(db, business.rules, clean.map((c) => c.payout));
  if (count > MAX_ADDRESSES) throw new Error(tooManyText(count));
  const ids: string[] = [];
  await db.$transaction(async (tx) => {
    for (const c of clean) {
      const row = await tx.payee.create({
        data: {
          name: c.name,
          category: c.category,
          payout: JSON.stringify(c.payout),
          prices: JSON.stringify(c.prices.map((p) => PriceItemSchema.parse(p))),
          recurring: JSON.stringify(c.recurring),
        },
      });
      ids.push(row.id);
    }
  });
  await audit(db, owner, "payees_added", `You added ${ids.length} people at once`, { ids });
  await applyToSimulatedAccount(db);
  return ids;
}

/** Name, category, prices and recurring pay. Does not touch payout details. */
export async function updatePayeeDetails(
  db: PrismaClient,
  owner: OwnerSession,
  id: string,
  input: Omit<PayeeInput, "payout">,
) {
  await assertOwner(db, owner);
  await db.payee.update({
    where: { id },
    data: {
      name: input.name.trim(),
      category: input.category,
      prices: JSON.stringify(input.prices.map((p) => PriceItemSchema.parse(p))),
      recurring: JSON.stringify(input.recurring),
    },
  });
  await audit(db, owner, "payee_updated", `You updated ${input.name}'s details`, { id });

  // Regular pay that is due but not sent yet follows the new amount (or goes, if the regular pay was removed).
  // A try with an unclear result (network trouble) keeps its amount, so its replay can never pay twice.
  const unsent = await db.planItem.findMany({
    where: { payeeId: id, kind: "wages", placement: "in", payStatus: { in: ["planned", "waiting"] }, NOT: { payCode: "transient" }, plan: { status: { in: ["draft", "approved"] } } },
  });
  for (const item of unsent) {
    if (!input.recurring) {
      await db.planItem.update({ where: { id: item.id }, data: { placement: "removed", reason: "You removed their regular pay." } });
    } else if (item.amountUsd !== input.recurring.amountUsd || item.payeeName !== input.name.trim()) {
      await db.planItem.update({
        where: { id: item.id },
        data: {
          amountUsd: input.recurring.amountUsd,
          payeeName: input.name.trim(),
          quote: null,
          quoteError: null,
          retryAt: null,
          // New request bodies get new idempotency keys (nothing was sent under the old ones).
          attempts: { increment: 1 },
        },
      });
      await audit(db, owner, "plan_item_updated", `${input.name}'s waiting ${item.forWhat.toLowerCase()} is now ${formatUsd(BigInt(input.recurring.amountUsd))}`, { itemId: item.id });
    }
    await recomputeFee(db, item.planId);
  }
}

/** Changing where a payee is paid starts a 48-hour hold on that payee. */
export async function changePayout(db: PrismaClient, owner: OwnerSession, id: string, payout: Payout, now = new Date()) {
  const business = await assertOwner(db, owner);
  const clean = cleanPayout(business.rules, payout);
  const before = await db.payee.findUniqueOrThrow({ where: { id } });
  // The 48-hour hold guards against a fake "our details changed" message about someone you've paid before.
  // For someone who has never been paid there is nothing to divert, so their change applies at once.
  const paidBefore = Boolean(before.trustedAt) && (await db.planItem.count({ where: { payeeId: id, payStatus: "delivered" } })) > 0;
  await db.payee.update({ where: { id }, data: { payout: JSON.stringify(clean), payoutChangedAt: paidBefore ? now : null } });
  if (!paidBefore) {
    // Their payments not sent yet go to the new address.
    await db.planItem.updateMany({
      where: { payeeId: id, placement: "in", payStatus: { in: ["planned", "waiting"] } },
      data: { payout: JSON.stringify(clean), quote: null, quoteError: null },
    });
    // A payment that failed is tried again at the new address: changing where they're paid is the owner's fix.
    // New request bodies get new idempotency keys (nothing went out under the old ones).
    const failed = await db.planItem.findMany({ where: { payeeId: id, placement: "in", payStatus: { in: ["failed", "refunded"] } }, select: { id: true, planId: true } });
    if (failed.length) {
      await db.planItem.updateMany({
        where: { id: { in: failed.map((f) => f.id) } },
        data: { payout: JSON.stringify(clean), payStatus: "planned", payReason: null, payCode: null, retryAt: null, attempts: { increment: 1 }, quote: null, quoteError: null },
      });
      await db.plan.updateMany({ where: { id: { in: failed.map((f) => f.planId) }, status: "done" }, data: { status: "approved" } });
    }
    // Live: the new address isn't payable until the owner's wallet confirms it, so the agent waits for that
    // (confirming trusts them again: lib/trust.ts) instead of being refused by the account.
    if ((await getAccountRecord(db))?.backend === "agent-api") await db.payee.update({ where: { id }, data: { trustedAt: null } });
  }
  await audit(
    db,
    owner,
    "payout_changed",
    paidBefore
      ? `You changed where ${before.name} gets paid. Payments to them are on a 48-hour safety hold.`
      : `You changed where ${before.name} gets paid (${clean.token.symbol} on ${clean.token.chain}).`,
    { id, before: JSON.parse(before.payout), after: clean },
  );
  await applyToSimulatedAccount(db);
  return { hold: paidBefore };
}

/** Try a payment that didn't go through again, optionally with a new amount, to the person's current details. */
export async function retryPayment(db: PrismaClient, owner: OwnerSession, itemId: string, amountUsd?: bigint) {
  await assertOwner(db, owner);
  const item = await db.planItem.findUnique({ where: { id: itemId }, include: { plan: true } });
  if (!item || item.placement !== "in" || !["failed", "refunded", "waiting"].includes(item.payStatus)) throw new Error("This payment can't be tried again.");
  if (amountUsd !== undefined && amountUsd <= 0n) throw new Error("The amount must be more than zero.");
  const payee = item.payeeId ? await getPayee(db, item.payeeId) : null;
  if (item.kind !== "fee" && !payee) throw new Error("This person isn't on your list any more. Add them again to pay them.");
  await db.planItem.update({
    where: { id: itemId },
    data: {
      payStatus: "planned",
      payReason: null,
      payCode: null,
      retryAt: null,
      // A new try sends new requests (new idempotency keys): nothing went out under the old ones.
      attempts: { increment: 1 },
      ...(amountUsd !== undefined ? { amountUsd: amountUsd.toString() } : {}),
      ...(payee ? { payout: JSON.stringify(payee.payout), payeeName: payee.name } : {}),
      quote: null,
      quoteError: null,
    },
  });
  if (item.plan.status === "done") await db.plan.update({ where: { id: item.planId }, data: { status: "approved" } });
  await audit(db, owner, "plan_item_approved", `You asked the agent to try paying ${item.payeeName} again${amountUsd !== undefined ? ` (${formatUsd(amountUsd)})` : ""}`, { itemId });
}

/** Drop a payment that didn't go through. A one-time person with nothing else owed comes off the list too. */
export async function cancelPayment(db: PrismaClient, owner: OwnerSession, itemId: string) {
  await assertOwner(db, owner);
  const item = await db.planItem.findUnique({ where: { id: itemId } });
  if (!item || item.placement !== "in" || ["sent", "delivered", "paying"].includes(item.payStatus)) throw new Error("This payment can't be cancelled.");
  await db.planItem.update({ where: { id: itemId }, data: { placement: "removed", reason: "You cancelled it." } });
  await audit(db, owner, "plan_item_removed", `You cancelled the payment to ${item.payeeName} (${item.forWhat})`, { itemId });
  const payee = item.payeeId ? await db.payee.findFirst({ where: { id: item.payeeId, removedAt: null, removeAfterPaid: true } }) : null;
  if (payee) {
    const owed = await db.planItem.count({ where: { payeeId: payee.id, placement: "in", payStatus: { in: ["planned", "waiting", "paying", "sent"] } } });
    if (owed === 0) {
      await db.payee.update({ where: { id: payee.id }, data: { removedAt: new Date() } });
      await audit(db, owner, "payee_removed", `${payee.name} came off your list (a one-time payment you cancelled)`, { id: payee.id });
    }
  }
}

export async function removePayee(db: PrismaClient, owner: OwnerSession, id: string) {
  await assertOwner(db, owner);
  const row = await db.payee.update({ where: { id }, data: { removedAt: new Date() } });
  await audit(db, owner, "payee_removed", `You removed ${row.name}`, { id });
  // Take them out of any list still waiting for the owner's OK, so it matches who can be paid.
  const waiting = await db.planItem.findMany({ where: { payeeId: id, placement: "in", plan: { status: "draft" } }, select: { id: true, planId: true } });
  if (waiting.length) {
    await db.planItem.updateMany({ where: { id: { in: waiting.map((i) => i.id) } }, data: { placement: "removed", reason: "You removed this person." } });
    for (const planId of new Set(waiting.map((i) => i.planId))) await recomputeFee(db, planId);
  }
  await applyToSimulatedAccount(db);
}

// --- The weekly plan: only the owner approves or removes -------------------

/** The owner approved a payment to them: from now on their routine payments need no extra OK. */
async function trust(db: PrismaClient, payeeIds: string[]) {
  const ids = payeeIds.filter(Boolean);
  if (ids.length) await db.payee.updateMany({ where: { id: { in: ids }, trustedAt: null }, data: { trustedAt: new Date() } });
}

async function draftItem(db: PrismaClient, itemId: string) {
  const item = await db.planItem.findUnique({ where: { id: itemId }, include: { plan: true } });
  if (!item) throw new Error("That payment isn't in this week's list any more.");
  if (item.plan.status !== "draft") throw new Error("You've already approved this week's payments.");
  return item;
}

/** The owner's own tap for a payment that needs it (above the threshold or a new payee). */
export async function approvePlanItem(db: PrismaClient, owner: OwnerSession, itemId: string) {
  await assertOwner(db, owner);
  // Works on the owner's draft list and on the agent's own runs (an exception waiting for the owner).
  const item = await db.planItem.findUnique({ where: { id: itemId }, include: { plan: true } });
  if (!item) throw new Error("That payment isn't in the list any more.");
  if (item.plan.status === "done" || item.payStatus !== "planned") throw new Error("This payment has already been handled.");
  if (item.ownTapAt) throw new Error("You've already OK'd this payment.");
  if (item.placement !== "in" || !item.needsOwnTap) throw new Error("This payment doesn't need its own OK.");
  await db.planItem.update({ where: { id: itemId }, data: { ownTapAt: new Date() } });
  await trust(db, [item.payeeId]);
  await audit(db, owner, "plan_item_approved", `You OK'd ${item.payeeName}: ${item.forWhat}`, { itemId });
}

export async function removePlanItem(db: PrismaClient, owner: OwnerSession, itemId: string) {
  await assertOwner(db, owner);
  const item = await draftItem(db, itemId);
  if (item.placement !== "in") throw new Error("Only payments in this week's list can be taken out.");
  if (item.kind === "fee") throw new Error("Bursar's fee is part of your spending rules.");
  await db.planItem.update({ where: { id: itemId }, data: { placement: "removed", reason: "Removed by the owner." } });
  await audit(db, owner, "plan_item_removed", `You took ${item.payeeName} (${item.forWhat}) out of this week's payments`, { itemId });
  await recomputeFee(db, item.planId);
}

/** Bursar's fee is a share of the payments in the plan; after a removal it shrinks with them. */
async function recomputeFee(db: PrismaClient, planId: string) {
  const business = await getBusiness(db);
  const items = await db.planItem.findMany({ where: { planId } });
  const fee = items.find((i) => i.kind === "fee" && i.placement === "in");
  if (!fee || !business?.rules.fee) return;
  const base = items.filter((i) => i.kind !== "fee" && i.placement === "in").reduce((a, i) => a + BigInt(i.amountUsd), 0n);
  const amount = (base * BigInt(business.rules.fee.bps)) / 10_000n;
  const pct = (business.rules.fee.bps / 100).toFixed(2).replace(/\.?0+$/, "");
  const forWhat = `Bursar fee (${pct}% of ${formatUsd(base)})`;
  if (amount === 0n) await db.planItem.update({ where: { id: fee.id }, data: { placement: "removed", reason: "Nothing left to charge a fee on." } });
  else await db.planItem.update({ where: { id: fee.id }, data: { amountUsd: amount.toString(), forWhat, quote: null } });
}

/** One tap for the whole plan. Items that need their own tap must have it first. */
export async function approvePlan(db: PrismaClient, owner: OwnerSession, planId: string) {
  await assertOwner(db, owner);
  const plan = await db.plan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan) throw new Error("Plan not found.");
  if (plan.status !== "draft") throw new Error("You've already approved this week's payments.");
  const inPlan = plan.items.filter((i) => i.placement === "in");
  if (inPlan.length === 0) throw new Error("There's nothing to pay this week.");
  const waiting = inPlan.filter((i) => i.needsOwnTap && !i.ownTapAt);
  if (waiting.length) {
    throw new Error(`First give your own OK to (or take out): ${waiting.map((i) => `${i.payeeName}, ${i.forWhat}`).join("; ")}.`);
  }
  await db.plan.update({ where: { id: planId }, data: { status: "approved", approvedAt: new Date(), approvedBy: owner.accountId } });
  await trust(db, inPlan.map((i) => i.payeeId));
  await audit(db, owner, "plan_approved", `You approved this week's payments (${inPlan.length})`, { planId });
}

/**
 * "Pay Bisi $20 now": a one-off payment the owner asked for (from chat or a
 * button) to someone already on their list. The owner's own confirmation is
 * the approval; the agent pays it at once, and the account's limits still apply.
 */
export async function requestOneOffPayment(db: PrismaClient, owner: OwnerSession, input: { payeeId: string; amountUsd: bigint; note: string }) {
  await assertOwner(db, owner);
  const payee = await getPayee(db, input.payeeId);
  if (!payee) throw new Error("That person isn't on your list. Only you can add someone, on the People page.");
  if (input.amountUsd <= 0n) throw new Error("The amount must be more than zero.");
  const forWhat = input.note.trim().slice(0, 80) || "One-off payment";
  const now = new Date();
  const plan = await db.plan.create({
    data: {
      status: "approved",
      approvedAt: now,
      approvedBy: owner.accountId,
      capLeftUsd: "0",
      items: {
        create: [
          {
            kind: "one_off",
            payeeId: payee.id,
            payeeName: payee.name,
            forWhat,
            amountUsd: input.amountUsd.toString(),
            payout: JSON.stringify(payee.payout),
            placement: "in",
            needsOwnTap: false,
            dueKey: `oneoff:${randomUUID()}`,
            dueOn: now.toISOString().slice(0, 10),
          },
        ],
      },
    },
  });
  // Practice mode: the owner's request is the approval. Live: the owner's wallet must have signed them in first
  // (the agent waits for that, and confirming in the wallet trusts them: lib/trust.ts).
  if ((await getAccountRecord(db))?.backend !== "agent-api") await trust(db, [payee.id]);
  await audit(db, owner, "plan_item_approved", `You asked the agent to pay ${payee.name} ${formatUsd(input.amountUsd)} (${forWhat})`, { planId: plan.id });
  return plan.id;
}

/**
 * "Pay someone once": adds them (marked to come off the list once paid, if the owner wants)
 * and asks the agent to pay them. Live, the payment waits until the owner's wallet confirms them.
 */
export async function payOnce(
  db: PrismaClient,
  owner: OwnerSession,
  input: { name: string; amountUsd: bigint; note: string; payout: Payout; removeAfterPaid: boolean },
): Promise<string> {
  if (input.amountUsd <= 0n) throw new Error("The amount must be more than zero.");
  const payeeId = await addPayee(db, owner, { name: input.name, category: "supplier", payout: input.payout, prices: [], recurring: null });
  if (input.removeAfterPaid) await db.payee.update({ where: { id: payeeId }, data: { removeAfterPaid: true } });
  await requestOneOffPayment(db, owner, { payeeId, amountUsd: input.amountUsd, note: input.note });
  return payeeId;
}
