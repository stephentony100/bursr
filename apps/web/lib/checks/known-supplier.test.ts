import { describe, expect, it } from "vitest";
import { knownSupplier } from "./known-supplier";
import { ctx, inv } from "./test-helpers";

describe("known supplier", () => {
  it("passes a payee on the list, ignoring case, punctuation and 'Ltd'", () => {
    expect(knownSupplier(inv({ supplierName: "MAMA PUT FARMS" }), ctx()).status).toBe("pass");
    expect(knownSupplier(inv({ supplierName: "Mama Put Farms Ltd." }), ctx()).status).toBe("pass");
  });

  it("holds a supplier that is not on the list", () => {
    const r = knownSupplier(inv({ supplierName: "Unity Bakery" }), ctx());
    expect(r.status).toBe("hold");
    expect(r.reason).toContain('New name: "Unity Bakery"');
  });

  it("leaves look-alikes to the look-alike check", () => {
    expect(knownSupplier(inv({ supplierName: "Ek0 Fresh Foods" }), ctx()).status).toBe("pass");
  });
});
