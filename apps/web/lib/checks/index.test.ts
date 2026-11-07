import { describe, expect, it } from "vitest";
import { demoTronAddress } from "../demo-addresses";
import { prepareForChecks, runChecks } from "./index";
import { ctx, extracted, inv, NOW } from "./test-helpers";

describe("runChecks and prepareForChecks", () => {
  it("a clean invoice is ready", () => {
    expect(runChecks(inv(), ctx()).status).toBe("ready");
  });

  it("the worst result wins: block beats hold", () => {
    const v = runChecks(inv({ supplierName: "Ek0 Fresh Foods", total: "1.00" }), ctx());
    expect(v.status).toBe("block");
    expect(v.results.filter((r) => r.status !== "pass").map((r) => r.check)).toEqual(["look-alike", "arithmetic"]);
  });

  it("an AI flag alone leaves the invoice payable, with the reason shown", () => {
    expect(runChecks(inv({ urgencyNote: "URGENT" }), ctx()).status).toBe("flag");
  });

  it("never guesses: unsure fields go to the owner, and the checks still run", () => {
    const p = prepareForChecks("x", extracted({ unsureFields: ["total"] }), NOW);
    expect(p.needsOwner).toContain("not sure about: total");
    const v = runChecks(p.invoice, ctx(), p.needsOwner);
    expect(v.status).toBe("needs_owner");
    expect(v.results).toHaveLength(8);
  });

  it("a block is never hidden behind 'needs you'", () => {
    const p = prepareForChecks(
      "x",
      extracted({
        supplierName: "Eko Fresh Foods",
        unsureFields: ["supplierName"],
        payout: { chain: "tron", token: "USDT", address: demoTronAddress("eko-new-account") },
      }),
      NOW,
    );
    const v = runChecks(p.invoice, ctx(), p.needsOwner);
    expect(v.status).toBe("block");
    expect(v.results.find((r) => r.check === "payout-changed")?.status).toBe("block");
  });

  it("never converts currencies: non-USD goes to the owner and amount checks are skipped", () => {
    const p = prepareForChecks("x", extracted({ currency: "NGN", total: "9999999.00" }), NOW);
    expect(p.needsOwner).toContain("NGN");
    expect(p.invoice.amountsKnown).toBe(false);
    expect(p.invoice.totalUsd).toBe(0n);
  });

  it("an amount that is not a plain number goes to the owner", () => {
    const p = prepareForChecks("x", extracted({ total: "1,000.00" }), NOW);
    expect(p.needsOwner).toContain("could not be read as a number");
    expect(p.invoice.amountsKnown).toBe(false);
  });
});
