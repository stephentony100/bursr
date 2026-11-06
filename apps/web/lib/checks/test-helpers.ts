import { demoTronAddress } from "../demo-addresses";
import type { ExtractedInvoice } from "../reader-schema";
import { payee, rules, USDT_TRON, usd } from "../test-fixtures";
import { prepareForChecks, type CheckContext, type InvoiceForChecks, type PastInvoice } from "./index";

export const FARM = payee({
  id: "farm",
  name: "Mama Put Farms Ltd",
  prices: [
    { item: "Tomatoes (crate)", unitPriceUsd: usd(18), toleranceBps: 500 },
    { item: "Onions (bag)", unitPriceUsd: usd(21), toleranceBps: 500 },
  ],
});
export const EKO = payee({
  id: "eko",
  name: "Eko Fresh Foods",
  payout: { token: USDT_TRON, address: demoTronAddress("eko"), memo: null },
});

export function extracted(over: Partial<ExtractedInvoice> = {}): ExtractedInvoice {
  return {
    supplierName: "Mama Put Farms Ltd",
    invoiceNumber: "MPF-0412",
    invoiceDate: "2026-11-02",
    dueDate: "2026-11-09",
    currency: "USD",
    lines: [
      { description: "Tomatoes (crate)", quantity: "4", unitPrice: "18.00", lineTotal: "72.00" },
      { description: "Onions (bag)", quantity: "1", unitPrice: "21.00", lineTotal: "21.00" },
    ],
    total: "93.00",
    payout: null,
    urgencyNote: null,
    unsureFields: [],
    ...over,
  };
}

export const NOW = new Date("2026-11-06T10:00:00Z");

export function inv(over: Partial<ExtractedInvoice> = {}, receivedAt = NOW): InvoiceForChecks {
  const p = prepareForChecks("new", extracted(over), receivedAt);
  if (!p.ok) throw new Error(p.reason);
  return p.invoice;
}

export function ctx(over: Partial<CheckContext> = {}): CheckContext {
  return { payees: [FARM, EKO], history: [], rules: rules(), committedThisWeekUsd: 0n, ...over };
}

export function past(over: Partial<PastInvoice> = {}): PastInvoice {
  return {
    id: "old",
    payeeId: "farm",
    supplierName: "Mama Put Farms Ltd",
    invoiceNumber: "MPF-0400",
    totalUsd: 50_000_000n,
    receivedAt: new Date("2026-11-01T10:00:00Z"),
    ...over,
  };
}
