// What the home page shows of the sample restaurant's week. It mirrors
// lib/sample.ts and lib/sample-invoices.ts (which use node:crypto and cannot
// load in the browser); week-data.test.ts fails if the two ever disagree.
// Amounts are integer cents.

export type Verdict = "ready" | "hold" | "block";

export interface WeekInvoice {
  number: string;
  supplier: string;
  lines: { description: string; total: string }[];
  totalCents: number;
  verdict: Verdict;
  /** What the stamp says under the verdict. */
  note: string;
}

export const WEEK_INVOICES: WeekInvoice[] = [
  {
    number: "MPF-0412",
    supplier: "Mama Put Farms Ltd",
    lines: [
      { description: "Tomatoes (crate)", total: "72.00" },
      { description: "Fresh pepper (bag)", total: "25.00" },
    ],
    totalCents: 11800,
    verdict: "ready",
    note: "Checks out",
  },
  {
    number: "IGC-2291",
    supplier: "Ikeja Gas & Charcoal",
    lines: [{ description: "Cooking gas refill (12.5kg)", total: "90.00" }],
    totalCents: 9000,
    verdict: "ready",
    note: "Checks out",
  },
  {
    number: "EFF-7781",
    supplier: "Ek0 Fresh Foods",
    lines: [
      { description: "Chicken (carton)", total: "225.00" },
      { description: "Catfish (kg)", total: "60.00" },
    ],
    totalCents: 28500,
    verdict: "block",
    note: "Look-alike name",
  },
  {
    number: "MPF-0412",
    supplier: "Mama Put Farms Ltd",
    lines: [
      { description: "Tomatoes (crate)", total: "72.00" },
      { description: "Fresh pepper (bag)", total: "25.00" },
    ],
    totalCents: 11800,
    verdict: "hold",
    note: "Sent twice",
  },
  {
    number: "EFF-7790",
    supplier: "Eko Fresh Foods",
    lines: [
      { description: "Chicken (carton)", total: "180.00" },
      { description: "Catfish (kg)", total: "48.00" },
    ],
    totalCents: 22800,
    verdict: "block",
    note: "New bank details",
  },
  {
    number: "MPF-0419",
    supplier: "Mama Put Farms Ltd",
    lines: [
      { description: "Tomatoes (crate)", total: "140.40" },
      { description: "Onions (bag)", total: "42.00" },
    ],
    totalCents: 18240,
    verdict: "hold",
    note: "Tomatoes +30%",
  },
];

export type Network = "NEAR" | "Base" | "Tron" | "Solana";
export const NETWORKS: Network[] = ["NEAR", "Base", "Tron", "Solana"];

export interface WeekPayment {
  who: string;
  what: string;
  cents: number;
  token: "USDC" | "USDT";
  network: Network;
}

/** This week's list: the two clean invoices, the staff's weekly pay and Bursar's 0.5% fee. */
export const WEEK_PAYMENTS: WeekPayment[] = [
  { who: "Mama Put Farms Ltd", what: "Invoice #MPF-0412", cents: 11800, token: "USDC", network: "NEAR" },
  { who: "Ikeja Gas & Charcoal", what: "Invoice #IGC-2291", cents: 9000, token: "USDC", network: "Base" },
  { who: "Bisi Adeyemi", what: "Weekly pay · head chef", cents: 22000, token: "USDC", network: "Base" },
  { who: "Tunde Okafor", what: "Weekly pay · server", cents: 11000, token: "USDT", network: "Tron" },
  { who: "Amaka Eze", what: "Weekly pay · cashier", cents: 12000, token: "USDC", network: "Solana" },
  { who: "Bursar fee", what: "0.5% of $658.00", cents: 329, token: "USDC", network: "NEAR" },
];

export const WEEK_TOTAL_CENTS = WEEK_PAYMENTS.reduce((s, p) => s + p.cents, 0);

/** Integer cents to "$1,234.56". */
export function usd(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const rest = String(Math.abs(cents % 100)).padStart(2, "0");
  return `$${whole.toLocaleString("en-US")}.${rest}`;
}
