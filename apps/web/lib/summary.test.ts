import { describe, expect, it } from "vitest";
import { inventedNumbers, plainSummary, type MonthFacts } from "./summary";

const M = 1_000_000n;
const facts: MonthFacts = {
  month: "November 2026",
  paidUsd: 658n * M,
  payments: 5,
  staffUsd: 450n * M,
  suppliersUsd: 208n * M,
  otherUsd: 0n,
  feesUsd: 0n,
  topPayees: [{ name: "Bisi Adeyemi (head chef)", usd: 220n * M }],
  invoices: 6,
  invoicesReady: 2,
  invoicesBlocked: 2,
  invoicesHeld: 2,
  refusedByAccount: 1,
  failedPayments: 0,
};

describe("monthly summary", () => {
  it("Bursr's own summary states the facts exactly", () => {
    expect(plainSummary(facts)).toBe(
      "In November 2026 Bursr paid $658.00 in 5 payments: $450.00 to staff and $208.00 to suppliers. " +
        "The largest was Bisi Adeyemi (head chef) at $220.00. " +
        "6 invoices came in: 2 passed every check, 2 were blocked as possible fraud and 2 were held for you to check. " +
        "Your spending rules blocked 1 payment that broke your limits.",
    );
  });

  it("accepts a rephrasing that only uses the facts' figures", () => {
    const text = "November 2026 was steady: you paid $658 across 5 payments, $450.00 of it to your staff and $208 to suppliers. Bisi got the most, $220.";
    expect(inventedNumbers(text, facts)).toEqual([]);
    expect(inventedNumbers(plainSummary(facts), facts)).toEqual([]);
  });

  it("catches any invented, rounded or calculated number", () => {
    expect(inventedNumbers("You paid about $660 this month.", facts)).toEqual(["660"]);
    expect(inventedNumbers("Staff took 68% of spending.", facts)).toEqual(["68"]);
    expect(inventedNumbers("You saved $1,200 by blocking fraud.", facts)).toEqual(["1,200"]);
    expect(inventedNumbers("Bursr made seven payments.", facts)).toEqual(["seven"]);
    expect(inventedNumbers("Bursr made five payments; six invoices arrived; one was refused.", facts)).toEqual([]);
  });
});
