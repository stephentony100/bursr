import { describe, expect, it } from "vitest";
import { arithmetic } from "./arithmetic";
import { ctx, inv } from "./test-helpers";

describe("arithmetic", () => {
  it("passes when lines and total add up", () => {
    expect(arithmetic(inv(), ctx()).status).toBe("pass");
  });

  it("holds a total that does not equal the sum of lines", () => {
    const r = arithmetic(inv({ total: "103.00" }), ctx());
    expect(r.status).toBe("hold");
    expect(r.reason).toContain("the lines add up to $93.00 but the total says $103.00");
  });

  it("holds a line where quantity × price is wrong", () => {
    const r = arithmetic(
      inv({ lines: [{ description: "Tomatoes (crate)", quantity: "4", unitPrice: "18.00", lineTotal: "82.00" }], total: "82.00" }),
      ctx(),
    );
    expect(r.status).toBe("hold");
    expect(r.reason).toContain("4 × $18.00 is $72.00, not $82.00");
  });

  it("handles fractional quantities exactly", () => {
    const r = arithmetic(
      inv({ lines: [{ description: "Catfish (kg)", quantity: "2.5", unitPrice: "6.00", lineTotal: "15.00" }], total: "15.00" }),
      ctx(),
    );
    expect(r.status).toBe("pass");
  });
});
