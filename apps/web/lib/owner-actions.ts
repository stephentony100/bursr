import type { Policy } from "@near-intents-agent-api/sdk";
import { isDeepStrictEqual } from "node:util";
import { normaliseAddress, PayoutSchema, PriceItemSchema, RulesSchema, type Payee, type Payout, type PriceItem, type Rules } from "./domain";
import { addressProblem } from "./address";
import type { PrismaClient } from "./generated/prisma/client";
import { isOwnerSession, type OwnerSession } from "./owner";
import { formatUsd } from "./money";
import { buildPolicy } from "./policy";
import { getAccountRecord, getBusiness, listPayees } from "./store";

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

export async function addPayee(db: PrismaClient, owner: OwnerSession, input: PayeeInput): Promise<string> {
  const business = await assertOwner(db, owner);
  const payout = cleanPayout(business.rules, input.payout);
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
}

/** Changing where a payee is paid starts a 48-hour hold on that payee. */
export async function changePayout(db: PrismaClient, owner: OwnerSession, id: string, payout: Payout, now = new Date()) {
  const business = await assertOwner(db, owner);
  const clean = cleanPayout(business.rules, payout);
  const before = await db.payee.findUniqueOrThrow({ where: { id } });
  await db.payee.update({ where: { id }, data: { payout: JSON.stringify(clean), payoutChangedAt: now } });
  await audit(db, owner, "payout_changed", `You changed where ${before.name} gets paid. Payments to them are on a 48-hour safety hold.`, {
    id,
    before: JSON.parse(before.payout),
    after: clean,
  });
  await applyToSimulatedAccount(db);
}

export async function removePayee(db: PrismaClient, owner: OwnerSession, id: string) {
  await assertOwner(db, owner);
  const row = await db.payee.update({ where: { id }, data: { removedAt: new Date() } });
  await audit(db, owner, "payee_removed", `You removed ${row.name}`, { id });
  await applyToSimulatedAccount(db);
}

// --- The weekly plan: only the owner approves or removes -------------------

async function draftItem(db: PrismaClient, itemId: string) {
  const item = await db.planItem.findUnique({ where: { id: itemId }, include: { plan: true } });
  if (!item) throw new Error("That payment isn't in this week's list any more.");
  if (item.plan.status !== "draft") throw new Error("You've already approved this week's payments.");
  return item;
}

/** The owner's own tap for a payment that needs it (above the threshold or a new payee). */
export async function approvePlanItem(db: PrismaClient, owner: OwnerSession, itemId: string) {
  await assertOwner(db, owner);
  const item = await draftItem(db, itemId);
  if (item.placement !== "in" || !item.needsOwnTap) throw new Error("This payment doesn't need its own OK.");
  await db.planItem.update({ where: { id: itemId }, data: { ownTapAt: new Date() } });
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
  await audit(db, owner, "plan_approved", `You approved this week's payments (${inPlan.length})`, { planId });
}
