import { describe, expect, it } from "vitest";
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

  it("never guesses: unsure fields go to the owner", () => {
    const p = prepareForChecks("x", extracted({ unsureFields: ["total"] }), NOW);
    expect(p).toEqual({ ok: false, reason: expect.stringContaining("not sure about: total") });
  });

  it("never converts currencies: non-USD goes to the owner", () => {
    expect(prepareForChecks("x", extracted({ currency: "NGN" }), NOW).ok).toBe(false);
  });

  it("an amount that is not a plain number goes to the owner", () => {
    expect(prepareForChecks("x", extracted({ total: "1,000.00" }), NOW).ok).toBe(false);
  });
});
