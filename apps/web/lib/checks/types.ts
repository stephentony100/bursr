import type { Payee, Rules } from "../domain";
import type { ExtractedInvoice } from "../reader-schema";

// Every check is a pure function (invoice, payees, history, rules) → result,
// in its own file with its own test file (AGENTS.md conventions).

export type CheckStatus = "pass" | "flag" | "defer" | "hold" | "block";

/** Worst first. "block" stops payment; "hold" waits for the owner; "defer" moves to next week; "flag" only warns. */
export const SEVERITY: Record<CheckStatus, number> = { pass: 0, flag: 1, defer: 2, hold: 3, block: 4 };

export interface CheckResult {
  check: string;
  status: CheckStatus;
  /** Plain English for the owner. Empty when the check passes. */
  reason: string;
}

/** The invoice as the checks see it: the Reader's fields plus amounts converted to integers. */
export interface InvoiceForChecks {
  id: string;
  extracted: ExtractedInvoice;
  /** Total in USD micro-dollars (6 decimals). */
  totalUsd: bigint;
  /** Each line's quantity × unit price and line total, in micro-dollars, as printed. */
  lines: { description: string; quantity: string; unitPriceUsd: bigint; lineTotalUsd: bigint }[];
  receivedAt: Date;
}

/** Earlier invoices this business received (not this one). */
export interface PastInvoice {
  id: string;
  payeeId: string | null;
  supplierName: string;
  invoiceNumber: string;
  totalUsd: bigint;
  receivedAt: Date;
}

export interface CheckContext {
  payees: Payee[];
  history: PastInvoice[];
  rules: Rules;
  /** USD already committed to payments in the current week (plan, M3). */
  committedThisWeekUsd: bigint;
}

export type Check = (invoice: InvoiceForChecks, ctx: CheckContext) => CheckResult;

export const pass = (check: string): CheckResult => ({ check, status: "pass", reason: "" });
