import { describe, expect, it } from "vitest";
import { overpriced } from "./overpriced";
import { ctx, inv } from "./test-helpers";

// Line totals are written out, not computed, so the test data stays exact.
const tomatoes = (unitPrice: string, lineTotal: string) =>
  inv({ lines: [{ description: "Tomatoes (crate)", quantity: "4", unitPrice, lineTotal }], total: lineTotal });

describe("overpriced", () => {
  it("holds tomatoes billed 30% above the agreed price", () => {
    const r = overpriced(tomatoes("23.40", "93.60"), ctx());
    expect(r.status).toBe("hold");
    expect(r.reason).toBe("Tomatoes (crate) billed at $23.40, agreed $18.00 (30% more).");
  });

  it("passes a price inside the 5% tolerance", () => {
    expect(overpriced(tomatoes("18.90", "75.60"), ctx()).status).toBe("pass");
  });

  it("holds one cent above the tolerance", () => {
    expect(overpriced(tomatoes("18.91", "75.64"), ctx()).status).toBe("hold");
  });

  it("passes items with no agreed price, and suppliers with no price list", () => {
    const other = inv({ lines: [{ description: "Garlic", quantity: "1", unitPrice: "99.00", lineTotal: "99.00" }], total: "99.00" });
    expect(overpriced(other, ctx()).status).toBe("pass");
    expect(overpriced(inv({ supplierName: "Eko Fresh Foods" }), ctx()).status).toBe("pass");
  });
});
