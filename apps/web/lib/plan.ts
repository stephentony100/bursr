import { isOnPayoutHold, payoutHoldEndsAt, type Payee, type Payout, type Rules } from "./domain";
import type { InvoiceView } from "./invoices";
import { formatUsd } from "./money";
import { addDays, invoiceDueOn, lastDueOn, localDay, nextDueOn, paydayOnOrAfter } from "./schedule";
import { chainName } from "./tokens";

// Builds the week's payment plan from invoices that passed the checks and the
// staff's regular pay. Pure: no database, no network. The plan is only a
// proposal; the owner approves it, and the agent account still refuses any
// payment outside the rules when it is paid (lib/pay.ts).

export type Placement = "in" | "held" | "deferred";

export interface DraftItem {
  kind: "invoice" | "wages" | "fee";
  invoiceId: string | null;
  payeeId: string;
  payeeName: string;
  forWhat: string;
  amountUsd: bigint;
  /** null for a held invoice whose supplier is not a payee. */
  payout: Payout | null;
  placement: Placement;
  reason: string | null;
  needsOwnTap: boolean;
  ownTapReason: string | null;
  /** What this payment is for, so it is never scheduled twice: "<payeeId>@<due date>" or "inv:<invoiceId>". */
  dueKey?: string;
  /** The day it is due (YYYY-MM-DD in the business time zone). */
  dueOn?: string;
}

export interface PlanInput {
  invoices: InvoiceView[];
  payees: Payee[];
  rules: Rules;
  /** USD the account has already counted this 7-day period. */
  spentThisWeekUsd: bigint;
  /** Invoices already in an approved plan (paid or being paid). */
  handledInvoiceIds: Set<string>;
  /** dueKeys already in a plan (paid, being paid, waiting or taken out by the owner). */
  handledKeys?: Set<string>;
  now: Date;
  /**
   * Include payments due on or before this day (YYYY-MM-DD, business time zone).
   * The agent uses today; the owner's "get payments ready" uses the next payday.
   */
  dueBy?: string;
  /** List invoices that can't be paid (held, blocked) as plan lines. The agent leaves them on the Invoices page. */
  listHeld?: boolean;
  /** The agent's runs don't pre-trim to the weekly limit: the account itself refuses, and the agent waits for the refill. */
  ignoreCap?: boolean;
  /**
   * Live account: its weekly budget counts every action, so a payment in
   * another currency counts twice (the exchange, then the send). Practice
   * mode's simulator counts each payment once.
   */
  budgetCountsSwaps?: boolean;
}

export interface DraftPlan {
  items: DraftItem[];
  capLeftUsd: bigint;
  inTotalUsd: bigint;
}

const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

function problemsOf(inv: InvoiceView): string {
  // Blocks first (fraud signals), then anything the owner must check, then holds.
  const by = (status: string) => inv.results.filter((r) => r.status === status).map((r) => r.reason);
  const reasons = [...by("block"), ...(inv.needsOwner ? [inv.needsOwner] : []), ...by("hold"), ...by("defer")];
  return reasons.join(" ") || "Needs your attention.";
}

export function buildPlan(input: PlanInput): DraftPlan {
  const { rules, payees, now } = input;
  const cap = BigInt(rules.weeklyCapUsd);
  const capLeftUsd = cap > input.spentThisWeekUsd ? cap - input.spentThisWeekUsd : 0n;
  const perPayment = BigInt(rules.perPaymentCapUsd);
  const threshold = BigInt(rules.approvalThresholdUsd);
  const byId = new Map(payees.map((p) => [p.id, p]));

  type Candidate = Omit<DraftItem, "placement" | "reason" | "needsOwnTap" | "ownTapReason" | "payout"> & { payout: Payout; due: string };
  const candidates: Candidate[] = [];
  const items: DraftItem[] = [];

  // 1. Regular pay on each payee's own schedule (weekly, every other week, monthly), in the business's time zone.
  const today = localDay(now, rules.timeZone);
  const dueBy = input.dueBy ?? paydayOnOrAfter(today, rules.paydayWeekday);
  const handled = (key: string) => input.handledKeys?.has(key) ?? false;
  for (const p of payees) {
    if (!p.recurring) continue;
    const addedOn = localDay(new Date(p.addedAt), rules.timeZone);
    // The next due date within reach (today, or by the coming payday for the owner's list);
    // otherwise a missed one not yet paid is caught up, once.
    const next = nextDueOn(p.recurring, rules, addedOn, today);
    const last = lastDueOn(p.recurring, rules, addedOn, addDays(today, -1));
    const dueOn = next && next <= dueBy ? next : last;
    if (!dueOn || handled(`${p.id}@${dueOn}`)) continue;
    candidates.push({
      kind: "wages",
      invoiceId: null,
      payeeId: p.id,
      payeeName: p.name,
      forWhat: p.recurring.every === "week" ? "Weekly pay" : p.recurring.every === "two_weeks" ? "Pay (every 2 weeks)" : "Monthly pay",
      amountUsd: BigInt(p.recurring.amountUsd),
      payout: p.payout,
      due: `0000-${dueOn}`, // staff first
      dueKey: `${p.id}@${dueOn}`,
      dueOn,
    });
  }

  // 2. Invoices: ready ones become candidates; the rest are listed with their reasons.
  for (const inv of input.invoices) {
    if (input.handledInvoiceIds.has(inv.id) || handled(`inv:${inv.id}`)) continue;
    const payee = inv.payeeId ? byId.get(inv.payeeId) : undefined;
    const forWhat = `Invoice #${inv.invoiceNumber || "?"}`;
    if ((inv.status !== "ready" && inv.status !== "flag") || !payee) {
      if (input.listHeld === false) continue;
      items.push({
        kind: "invoice",
        invoiceId: inv.id,
        payeeId: payee?.id ?? "",
        payeeName: payee?.name ?? (inv.supplierName || inv.fileName),
        forWhat,
        amountUsd: inv.totalUsd,
        payout: payee?.payout ?? null,
        placement: "held",
        reason: problemsOf(inv),
        needsOwnTap: false,
        ownTapReason: null,
      });
      continue;
    }
    const invDueOn = invoiceDueOn({ receivedOn: localDay(inv.receivedAt, rules.timeZone), dueDate: inv.extracted?.dueDate ?? null }, rules);
    if (invDueOn > dueBy) continue; // not due yet: the agent pays it nearer its due date
    candidates.push({
      kind: "invoice",
      invoiceId: inv.id,
      payeeId: payee.id,
      payeeName: payee.name,
      forWhat,
      amountUsd: inv.totalUsd,
      payout: payee.payout,
      due: inv.extracted?.dueDate ?? "9999",
      dueKey: `inv:${inv.id}`,
      dueOn: invDueOn,
    });
  }

  // 3. Place candidates in order (staff, then by due date) under the weekly limit,
  // leaving room for Bursar's fee on everything placed.
  candidates.sort((a, b) => a.due.localeCompare(b.due));
  const feeOn = (amount: bigint) => (rules.fee ? (amount * BigInt(rules.fee.bps)) / 10_000n : 0n);
  let used = 0n;
  let budgetUsed = 0n;
  const needsSwap = (c: { payout: Payout | null }) => Boolean(c.payout && c.payout.token.assetId !== rules.treasury.assetId);
  const budgetCost = (c: { amountUsd: bigint; payout: Payout | null }) => (input.budgetCountsSwaps && needsSwap(c) ? 2n : 1n) * c.amountUsd;
  for (const c of candidates) {
    const { due: _due, ...base } = c;
    void _due;
    const payee = byId.get(c.payeeId)!;
    if (isOnPayoutHold(payee, now)) {
      items.push({ ...base, placement: "held", reason: `Their payment details changed recently; on a safety hold until ${day(payoutHoldEndsAt(payee)!)}.`, needsOwnTap: false, ownTapReason: null });
      continue;
    }
    if (c.amountUsd > perPayment) {
      items.push({
        ...base,
        placement: "held",
        reason: `${formatUsd(c.amountUsd)} is above your largest single payment of ${formatUsd(perPayment)}. The account would refuse it; raise the limit or pay it in parts.`,
        needsOwnTap: false,
        ownTapReason: null,
      });
      continue;
    }
    if (!input.ignoreCap && budgetUsed + budgetCost(c) + feeOn(used + c.amountUsd) > capLeftUsd) {
      const left = capLeftUsd - budgetUsed - feeOn(used);
      items.push({
        ...base,
        placement: "deferred",
        reason: `Moved to next week: only ${formatUsd(left > 0n ? left : 0n)} is left under your weekly limit of ${formatUsd(cap)}.${
          input.budgetCountsSwaps && needsSwap(c) ? ` Paying in ${c.payout!.token.symbol} on ${chainName(c.payout!.token.chain)} counts twice against the limit (the exchange, then the payment), so it needs ${formatUsd(budgetCost(c))}.` : ""
        }`,
        needsOwnTap: false,
        ownTapReason: null,
      });
      continue;
    }
    used += c.amountUsd;
    budgetUsed += budgetCost(c);
    const tapReasons: string[] = [];
    if (c.amountUsd > threshold) tapReasons.push(`above ${formatUsd(threshold)}`);
    if (!payee.trustedAt) tapReasons.push(`first payment to ${payee.name}`);
    items.push({
      ...base,
      placement: "in",
      reason: null,
      needsOwnTap: tapReasons.length > 0,
      ownTapReason: tapReasons.length ? `Needs your own tap: ${tapReasons.join(", ")}.` : null,
    });
  }

  // 4. Bursar's fee: one line for the plan, paid to the fee address on the owner's signed list.
  const fee = feeOn(used);
  if (rules.fee && fee > 0n) {
    items.push({
      kind: "fee",
      invoiceId: null,
      payeeId: "",
      payeeName: "Bursar",
      forWhat: `Bursar fee (${(rules.fee.bps / 100).toFixed(2).replace(/\.?0+$/, "")}% of ${formatUsd(used)})`,
      amountUsd: fee,
      payout: rules.fee.payout,
      placement: "in",
      reason: null,
      needsOwnTap: false,
      ownTapReason: null,
    });
    used += fee;
  }

  return { items, capLeftUsd, inTotalUsd: used };
}
