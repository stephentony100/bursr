import { isNewPayee, isOnPayoutHold, payoutHoldEndsAt, type Payee, type Payout, type Rules } from "./domain";
import type { InvoiceView } from "./invoices";
import { formatUsd } from "./money";

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
}

export interface PlanInput {
  invoices: InvoiceView[];
  payees: Payee[];
  rules: Rules;
  /** USD the account has already counted this 7-day period. */
  spentThisWeekUsd: bigint;
  /** Invoices already in an approved plan (paid or being paid). */
  handledInvoiceIds: Set<string>;
  /** Payees whose regular pay for this period was already paid. */
  wagesPaidPayeeIds: Set<string>;
  now: Date;
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

  // 1. Staff regular pay: weekly every payday; monthly on the first payday of the month.
  for (const p of payees) {
    if (!p.recurring || input.wagesPaidPayeeIds.has(p.id)) continue;
    if (p.recurring.every === "month" && now.getUTCDate() > 7) continue;
    candidates.push({
      kind: "wages",
      invoiceId: null,
      payeeId: p.id,
      payeeName: p.name,
      forWhat: p.recurring.every === "week" ? "Weekly pay" : "Monthly pay",
      amountUsd: BigInt(p.recurring.amountUsd),
      payout: p.payout,
      due: "0000", // staff first
    });
  }

  // 2. Invoices: ready ones become candidates; the rest are listed with their reasons.
  for (const inv of input.invoices) {
    if (input.handledInvoiceIds.has(inv.id)) continue;
    const payee = inv.payeeId ? byId.get(inv.payeeId) : undefined;
    const forWhat = `Invoice #${inv.invoiceNumber || "?"}`;
    if ((inv.status !== "ready" && inv.status !== "flag") || !payee) {
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
    candidates.push({
      kind: "invoice",
      invoiceId: inv.id,
      payeeId: payee.id,
      payeeName: payee.name,
      forWhat,
      amountUsd: inv.totalUsd,
      payout: payee.payout,
      due: inv.extracted?.dueDate ?? "9999",
    });
  }

  // 3. Place candidates in order (staff, then by due date) under the weekly limit,
  // leaving room for Bursar's fee on everything placed.
  candidates.sort((a, b) => a.due.localeCompare(b.due));
  const feeOn = (amount: bigint) => (rules.fee ? (amount * BigInt(rules.fee.bps)) / 10_000n : 0n);
  let used = 0n;
  for (const c of candidates) {
    const { due: _due, ...base } = c;
    void _due;
    const payee = byId.get(c.payeeId)!;
    if (isOnPayoutHold(payee, now)) {
      items.push({ ...base, placement: "held", reason: `Payout details changed recently; on hold until ${day(payoutHoldEndsAt(payee)!)}.`, needsOwnTap: false, ownTapReason: null });
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
    if (used + c.amountUsd + feeOn(used + c.amountUsd) > capLeftUsd) {
      items.push({
        ...base,
        placement: "deferred",
        reason: `Moved to next week: only ${formatUsd(capLeftUsd - used - feeOn(used))} is left under your weekly limit of ${formatUsd(cap)}.`,
        needsOwnTap: false,
        ownTapReason: null,
      });
      continue;
    }
    used += c.amountUsd;
    const tapReasons: string[] = [];
    if (c.amountUsd > threshold) tapReasons.push(`above ${formatUsd(threshold)}`);
    if (isNewPayee(payee, now)) tapReasons.push(`new payee (added ${day(new Date(payee.addedAt))})`);
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
