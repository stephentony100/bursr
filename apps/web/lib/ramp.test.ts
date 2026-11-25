import { describe, expect, it } from "vitest";
import { formatNgn, ngnFor, PRACTICE_KOBO_PER_USD, practiceRamp, RampError } from "./ramp";

describe("naira amounts", () => {
  it("rounds in Bursr's disfavour: the owner pays at most, and receives at least, the exact amount less a kobo", () => {
    // $1.000001 at ₦1,600: ₦1,600.0016 → pays ₦1,600.01, receives ₦1,600.00
    expect(ngnFor(1_000_001n, 160_000n, "on")).toBe(160_001n);
    expect(ngnFor(1_000_001n, 160_000n, "off")).toBe(160_000n);
    expect(ngnFor(25_000_000n, 160_000n, "on")).toBe(4_000_000n);
  });

  it("shows naira with commas and kobo", () => {
    expect(formatNgn(4_000_000n)).toBe("₦40,000.00");
    expect(formatNgn(160_001n)).toBe("₦1,600.01");
    expect(formatNgn(5n)).toBe("₦0.05");
  });
});

describe("practice ramp", () => {
  it("quotes at the practice rate", async () => {
    const q = await practiceRamp.quote("on", 10_000_000n);
    expect(q.koboPerUsd).toBe(PRACTICE_KOBO_PER_USD);
    expect(q.ngnKobo).toBe(1_600_000n);
  });

  it("gives practice bank details with the order as reference", async () => {
    const r = await practiceRamp.startOnRamp({ orderId: "ord_1", usdMicros: 10_000_000n, ngnKobo: 1_600_000n, deliverTo: "CVAULT" });
    expect(r.bankName).toMatch(/practice/i);
    expect(r.reference).toBe("ord_1");
  });

  it("checks a Nigerian account number before looking up the name", async () => {
    await expect(practiceRamp.accountName("Practice Bank", "123")).rejects.toBeInstanceOf(RampError);
    await expect(practiceRamp.accountName("Practice Bank", "0123456789")).resolves.toMatch(/practice/i);
  });

  it("refuses amounts outside the practice range", async () => {
    await expect(practiceRamp.quote("on", 0n)).rejects.toBeInstanceOf(RampError);
    await expect(practiceRamp.quote("on", 101_000_000n)).rejects.toBeInstanceOf(RampError);
  });
});
