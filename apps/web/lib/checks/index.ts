import { parseUnits, USD_DECIMALS } from "../money";
import type { ExtractedInvoice } from "../reader-schema";
import { arithmetic } from "./arithmetic";
import { duplicate } from "./duplicate";
import { knownSupplier } from "./known-supplier";
import { lookAlike } from "./look-alike";
import { overpriced } from "./overpriced";
import { payoutChanged } from "./payout-changed";
import { SEVERITY, type Check, type CheckContext, type CheckResult, type CheckStatus, type InvoiceForChecks } from "./types";
import { urgency } from "./urgency";
import { weeklyCap } from "./weekly-cap";

export * from "./types";

/** Hard rules first, AI judgement last (PRD §5.4). */
export const CHECKS: Check[] = [lookAlike, payoutChanged, knownSupplier, duplicate, arithmetic, overpriced, weeklyCap, urgency];

export type InvoiceStatus = "ready" | "needs_owner" | CheckStatus;

export interface Verdict {
  status: InvoiceStatus;
  results: CheckResult[];
}

/**
 * Runs every check. If the invoice also needs the owner (a field the Reader
 * was unsure of, another currency, an unreadable amount), it still gets every
 * check that can run, so a fraud signal is never hidden behind "needs you":
 * a block wins, then "needs owner", then the worst other result.
 */
export function runChecks(invoice: InvoiceForChecks, ctx: CheckContext, needsOwner: string | null = null): Verdict {
  const results = CHECKS.map((c) => c(invoice, ctx));
  const worst = results.reduce<CheckStatus>((w, r) => (SEVERITY[r.status] > SEVERITY[w] ? r.status : w), "pass");
  if (worst === "block") return { status: "block", results };
  if (needsOwner) return { status: "needs_owner", results };
  // "flag" stays payable (an AI opinion never blocks on its own); the owner sees the reason.
  return { status: worst === "pass" ? "ready" : worst, results };
}

export interface Prepared {
  invoice: InvoiceForChecks;
  /** Why the owner must look at it, or null. */
  needsOwner: string | null;
}

/**
 * Turns the Reader's fields into integer amounts. Never guesses: a field the
 * Reader was unsure of, a currency Bursar cannot pay in, or an amount that is
 * not a plain number gives a "needs owner" reason. Without trustworthy USD
 * amounts, the amount-based checks are skipped (amountsKnown: false).
 */
export function prepareForChecks(id: string, extracted: ExtractedInvoice, receivedAt: Date): Prepared {
  const reasons: string[] = [];
  if (extracted.unsureFields.length > 0) {
    const words: Record<string, string> = { supplierName: "the supplier's name", invoiceNumber: "the invoice number", invoiceDate: "the date", dueDate: "the due date", currency: "the currency", lines: "the items", total: "the total", payout: "the payment details" };
    reasons.push(`Bursar couldn't read ${extracted.unsureFields.map((f) => words[f] ?? f).join(", ")} clearly. Please check the invoice yourself.`);
  }
  const unknownAmounts: InvoiceForChecks = { id, extracted, totalUsd: 0n, lines: [], receivedAt, amountsKnown: false };
  if (extracted.currency.toUpperCase() !== "USD") {
    reasons.push(`This invoice is in ${extracted.currency}. Bursar pays dollar invoices for now, and never guesses an exchange rate.`);
    return { invoice: unknownAmounts, needsOwner: reasons.join(" ") };
  }
  try {
    const invoice: InvoiceForChecks = {
      id,
      extracted,
      totalUsd: parseUnits(extracted.total, USD_DECIMALS),
      lines: extracted.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPriceUsd: parseUnits(l.unitPrice, USD_DECIMALS),
        lineTotalUsd: parseUnits(l.lineTotal, USD_DECIMALS),
      })),
      receivedAt,
      amountsKnown: true,
    };
    return { invoice, needsOwner: reasons.length ? reasons.join(" ") : null };
  } catch {
    reasons.push("Bursar couldn't read one of the amounts clearly. Please check the invoice yourself.");
    return { invoice: unknownAmounts, needsOwner: reasons.join(" ") };
  }
}
