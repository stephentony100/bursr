import { describe, expect, it } from "vitest";
import { lookAlike } from "./look-alike";
import { levenshtein, skeleton } from "./names";
import { ctx, inv } from "./test-helpers";

describe("look-alike name", () => {
  it.each([
    ["Ek0 Fresh Foods"], // zero for o
    ["Eko Fresh Fooods"], // extra letter
    ["Mama Put Farrns Ltd"], // rn for m
    ["Mama Pvt Farms Ltd"], // v for u
    ["Ek0 Fre5h Foods"], // two swaps
  ])("blocks %s", (name) => {
    const r = lookAlike(inv({ supplierName: name }), ctx());
    expect(r.status).toBe("block");
    expect(r.reason).toMatch(/^Name looks like (Eko Fresh Foods|Mama Put Farms Ltd) but is not/);
  });

  it("passes the real name", () => {
    expect(lookAlike(inv({ supplierName: "Eko Fresh Foods" }), ctx()).status).toBe("pass");
    expect(lookAlike(inv({ supplierName: "eko fresh foods ltd" }), ctx()).status).toBe("pass");
  });

  it("passes a genuinely different supplier", () => {
    expect(lookAlike(inv({ supplierName: "Unity Bakery" }), ctx()).status).toBe("pass");
    expect(lookAlike(inv({ supplierName: "Eko Hotels" }), ctx()).status).toBe("pass");
  });

  it("helpers", () => {
    expect(skeleton("Ek0 Fresh Foods")).toBe(skeleton("Eko Fresh Foods"));
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
});
