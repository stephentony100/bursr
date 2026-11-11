import { describe, expect, it } from "vitest";
import snapshot from "../../../../fixtures/tokens.snapshot.json";
import { parseUnits, USD_DECIMALS } from "@/lib/money";
import { samplePayees, sampleRules } from "@/lib/sample";
import { SAMPLE_INVOICES } from "@/lib/sample-invoices";
import { chainName, stablecoinsFrom } from "@/lib/tokens";
import type { Token } from "@/lib/oneclick";
import { WEEK_INVOICES, WEEK_PAYMENTS, WEEK_TOTAL_CENTS, usd } from "./week-data";

// The home page must show the same week the demo runs (README "Try it").

const cents = (text: string) => Number(parseUnits(text, 2));

describe("home page week data", () => {
  const tokens = stablecoinsFrom(snapshot as Token[]);
  const payees = samplePayees(tokens);

  it("shows the six sample invoices with their real numbers and verdicts", () => {
    expect(WEEK_INVOICES).toHaveLength(SAMPLE_INVOICES.length);
    WEEK_INVOICES.forEach((w, i) => {
      const s = SAMPLE_INVOICES[i];
      expect(w.supplier).toBe(s.printed.supplierName);
      expect(w.number).toBe(s.printed.invoiceNumber);
      expect(w.totalCents).toBe(cents(s.printed.total));
      expect(w.verdict).toBe(s.expected.status);
      w.lines.forEach((l, j) => {
        expect(l.description).toBe(s.printed.lines[j].description);
        expect(l.total).toBe(s.printed.lines[j].lineTotal);
      });
    });
  });

  it("lists the clean invoices and the staff pay on the networks each payee chose", () => {
    for (const p of WEEK_PAYMENTS.filter((x) => x.who !== "Bursr fee")) {
      const payee = payees.find((x) => x.name.startsWith(p.who));
      expect(payee, p.who).toBeDefined();
      expect(chainName(payee!.payout.token.chain)).toBe(p.network);
      expect(payee!.payout.token.symbol).toBe(p.token);
      if (payee!.recurring) expect(BigInt(p.cents) * 10n ** BigInt(USD_DECIMALS - 2)).toBe(BigInt(payee!.recurring.amountUsd));
    }
    const ready = WEEK_INVOICES.filter((w) => w.verdict === "ready");
    expect(WEEK_PAYMENTS.filter((p) => p.what.startsWith("Invoice")).map((p) => p.cents)).toEqual(ready.map((w) => w.totalCents));
  });

  it("charges the fee at the sample rate and totals $661.29", () => {
    const fee = sampleRules(tokens).fee!;
    const paid = WEEK_PAYMENTS.filter((p) => p.who !== "Bursr fee").reduce((s, p) => s + p.cents, 0);
    expect(WEEK_PAYMENTS.find((p) => p.who === "Bursr fee")!.cents).toBe(Math.round((paid * fee.bps) / 10_000));
    expect(chainName(fee.payout.token.chain)).toBe("NEAR");
    expect(usd(WEEK_TOTAL_CENTS)).toBe("$661.29");
  });
});
