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

export function runChecks(invoice: InvoiceForChecks, ctx: CheckContext): Verdict {
  const results = CHECKS.map((c) => c(invoice, ctx));
  const worst = results.reduce<CheckStatus>((w, r) => (SEVERITY[r.status] > SEVERITY[w] ? r.status : w), "pass");
  // "flag" stays payable (an AI opinion never blocks on its own); the owner sees the reason.
  return { status: worst === "pass" ? "ready" : worst, results };
}

export type Prepared = { ok: true; invoice: InvoiceForChecks } | { ok: false; reason: string };

/**
 * Turns the Reader's fields into integer amounts. Never guesses: anything the
 * Reader was unsure of, a currency Bursar cannot pay in, or an amount that is
 * not a plain number sends the invoice to "needs owner" with the reason.
 */
export function prepareForChecks(id: string, extracted: ExtractedInvoice, receivedAt: Date): Prepared {
  if (extracted.unsureFields.length > 0) {
    return { ok: false, reason: `The reader was not sure about: ${extracted.unsureFields.join(", ")}. Check the invoice and enter it yourself.` };
  }
  if (extracted.currency.toUpperCase() !== "USD") {
    return { ok: false, reason: `This invoice is in ${extracted.currency}. Bursar only pays US-dollar invoices for now and never converts amounts itself.` };
  }
  try {
    return {
      ok: true,
      invoice: {
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
      },
    };
  } catch (e) {
    return { ok: false, reason: `An amount could not be read as a number (${e instanceof Error ? e.message : e}).` };
  }
}
