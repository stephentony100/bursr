import { demoNearImplicit, demoTronAddress } from "./demo-addresses";
import type { InvoiceStatus } from "./checks";
import type { ExtractedInvoice } from "./reader-schema";

// DRY-RUN SAMPLE INVOICES for the sample restaurant (lib/sample.ts). One week
// of bills: two clean, four with a problem (PRD §9). This data is the single
// source for three things: the invoice images in fixtures/invoices/ (drawn by
// scripts/make-sample-invoices.ts), the practice-mode reading of each image
// when no recorded NEAR AI reading exists, and the expected check results.

export interface SampleInvoice {
  file: string;
  /** Minutes after the first invoice that this one arrives (order matters for duplicates). */
  arrivesAfterMin: number;
  printed: ExtractedInvoice;
  /** Extra text on the paper that the Reader should notice (stamps, notices). */
  stamp?: string;
  notice?: string;
  expected: { status: InvoiceStatus; problems: string[] };
}

const line = (description: string, quantity: string, unitPrice: string, lineTotal: string) => ({ description, quantity, unitPrice, lineTotal });

const mamaPut = { chain: "near", token: "USDC", address: demoNearImplicit("mama-put-farms") };

export const SAMPLE_INVOICES: SampleInvoice[] = [
  {
    file: "01-mama-put-farms-MPF-0412.png",
    arrivesAfterMin: 0,
    printed: {
      supplierName: "Mama Put Farms Ltd",
      invoiceNumber: "MPF-0412",
      invoiceDate: "2026-11-02",
      dueDate: "2026-11-09",
      currency: "USD",
      lines: [line("Tomatoes (crate)", "4", "18.00", "72.00"), line("Fresh pepper (bag)", "2", "12.50", "25.00"), line("Onions (bag)", "1", "21.00", "21.00")],
      total: "118.00",
      payout: mamaPut,
      urgencyNote: null,
      unsureFields: [],
    },
    expected: { status: "ready", problems: [] },
  },
  {
    file: "02-ikeja-gas-IGC-2291.png",
    arrivesAfterMin: 35,
    printed: {
      supplierName: "Ikeja Gas & Charcoal",
      invoiceNumber: "IGC-2291",
      invoiceDate: "2026-11-03",
      dueDate: "2026-11-10",
      currency: "USD",
      lines: [line("Cooking gas refill (12.5kg)", "6", "15.00", "90.00")],
      total: "90.00",
      payout: null,
      urgencyNote: null,
      unsureFields: [],
    },
    expected: { status: "ready", problems: [] },
  },
  {
    file: "03-ek0-fresh-foods-EFF-7781.png",
    arrivesAfterMin: 80,
    printed: {
      supplierName: "Ek0 Fresh Foods",
      invoiceNumber: "EFF-7781",
      invoiceDate: "2026-11-03",
      dueDate: "2026-11-05",
      currency: "USD",
      lines: [line("Chicken (carton)", "5", "45.00", "225.00"), line("Catfish (kg)", "10", "6.00", "60.00")],
      total: "285.00",
      payout: { chain: "tron", token: "USDT", address: demoTronAddress("ek0-fresh-foods-scam") },
      urgencyNote: null,
      unsureFields: [],
    },
    expected: { status: "block", problems: ["look-alike"] },
  },
  {
    file: "04-mama-put-farms-MPF-0412-again.png",
    arrivesAfterMin: 140,
    stamp: "SENT AGAIN",
    printed: {
      supplierName: "Mama Put Farms Ltd",
      invoiceNumber: "MPF-0412",
      invoiceDate: "2026-11-02",
      dueDate: "2026-11-09",
      currency: "USD",
      lines: [line("Tomatoes (crate)", "4", "18.00", "72.00"), line("Fresh pepper (bag)", "2", "12.50", "25.00"), line("Onions (bag)", "1", "21.00", "21.00")],
      total: "118.00",
      payout: mamaPut,
      urgencyNote: null,
      unsureFields: [],
    },
    expected: { status: "hold", problems: ["duplicate"] },
  },
  {
    file: "05-eko-fresh-foods-EFF-7790.png",
    arrivesAfterMin: 200,
    notice: "NOTICE: Our bank details have changed. Pay ONLY to the new USDT (Tron) address below. Pay today or your supply will be stopped.",
    printed: {
      supplierName: "Eko Fresh Foods",
      invoiceNumber: "EFF-7790",
      invoiceDate: "2026-11-04",
      dueDate: "2026-11-04",
      currency: "USD",
      lines: [line("Chicken (carton)", "4", "45.00", "180.00"), line("Catfish (kg)", "8", "6.00", "48.00")],
      total: "228.00",
      payout: { chain: "tron", token: "USDT", address: demoTronAddress("eko-new-account") },
      urgencyNote: "Pay today or your supply will be stopped.",
      unsureFields: [],
    },
    expected: { status: "block", problems: ["payout-changed", "urgency"] },
  },
  {
    file: "06-mama-put-farms-MPF-0419.png",
    arrivesAfterMin: 260,
    printed: {
      supplierName: "Mama Put Farms Ltd",
      invoiceNumber: "MPF-0419",
      invoiceDate: "2026-11-05",
      dueDate: "2026-11-12",
      currency: "USD",
      lines: [line("Tomatoes (crate)", "6", "23.40", "140.40"), line("Onions (bag)", "2", "21.00", "42.00")],
      total: "182.40",
      payout: mamaPut,
      urgencyNote: null,
      unsureFields: [],
    },
    expected: { status: "hold", problems: ["overpriced"] },
  },
];
