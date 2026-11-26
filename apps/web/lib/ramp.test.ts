import { describe, expect, it } from "vitest";
import { formatNgn, makeLinqRamp, ngnFor, PRACTICE_KOBO_PER_USD, practiceRamp, RampError } from "./ramp";

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
    const r = await practiceRamp.startOnRamp({ orderId: "ord_1", usdMicros: 10_000_000n, ngnKobo: 1_600_000n, deliverTo: "CVAULT", customerRef: "b1" });
    expect(r.bankName).toMatch(/practice/i);
    expect(r.reference).toBe("ord_1");
  });

  it("checks a Nigerian account number before looking up the name", async () => {
    await expect(practiceRamp.accountName("000", "123")).rejects.toBeInstanceOf(RampError);
    await expect(practiceRamp.accountName("000", "0123456789")).resolves.toMatch(/practice/i);
  });

  it("refuses amounts outside the practice range", async () => {
    await expect(practiceRamp.quote("on", 0n)).rejects.toBeInstanceOf(RampError);
    await expect(practiceRamp.quote("on", 101_000_000n)).rejects.toBeInstanceOf(RampError);
  });
});

describe("Linq ramp", () => {
  const order = { id: "lq_1", walletAddress: "GDEPOSIT", coinType: "USDC:GA5Z", chain: "stellar", amountStableCoin: 5, amountNGN: 8275.5, rate: 1655.1, status: "initiated" };
  const fake = {
    rate: async () => 1655.1,
    verifyBank: async () => "John Doe",
    createOfframp: async (r: { amountStableCoin: string; idempotencyKey: string; refundAddress: string }) => ({ ...order, seen: r }),
    status: async () => ({ id: "lq_1", status: "disbursed" }),
    onrampRate: async () => 1356.15,
    createOnramp: async (r: { walletAddress: string; rate: number; amountStableCoin: string; customerRef: string }) => ({ orderId: "on_1", accountNumber: "9876543210", bankName: "Wema Bank", accountName: "Linq Onramp Payment", amountNgn: 8136.9, amountStableCoin: Number(r.amountStableCoin), fee: 50, expiresAt: "2026-12-01T10:00:00Z", status: "awaiting payment", seen: r }),
    trustsUsdc: async () => true,
  };
  const linq = makeLinqRamp(fake as never);

  it("quotes naira in at Linq's onramp rate and returns Linq's bank details and locked amounts", async () => {
    expect((await linq.quote("on", 6_000_000n)).koboPerUsd).toBe(135_615n);
    const r = await linq.startOnRamp({ orderId: "ord_9", usdMicros: 6_000_000n, ngnKobo: 0n, deliverTo: "GFEE", customerRef: "b1" });
    expect(r).toMatchObject({ bankName: "Wema Bank", accountNumber: "9876543210", providerOrderId: "on_1", ngnKobo: 813_690n, feeKobo: 5_000n });
    expect(r.expiresAt?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });

  it("asks for whole cents and reads Linq's locked amounts back", async () => {
    await expect(linq.quote("off", 5_000_001n)).rejects.toThrow(/cents/);
    const bank = { bankCode: "033", bankName: "UBA", accountNumber: "1234567890", accountName: "John Doe" };
    const placed = await linq.startOffRamp({ orderId: "ord_1", usdMicros: 5_000_000n, ngnKobo: 0n, bank, customerRef: "b1", refundAddress: "GFEE" });
    expect(placed).toEqual({ depositAddress: "GDEPOSIT", providerOrderId: "lq_1", usdMicros: 5_000_000n, ngnKobo: 827_550n, koboPerUsd: 165_510n });
  });
});
