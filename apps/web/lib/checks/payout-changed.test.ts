import { describe, expect, it } from "vitest";
import { demoTronAddress } from "../demo-addresses";
import { payoutChanged } from "./payout-changed";
import { ctx, EKO, inv } from "./test-helpers";

const eko = (address: string | null) =>
  inv({ supplierName: "Eko Fresh Foods", lines: [], total: "100.00", payout: address ? { chain: "tron", token: "USDT", address } : null });

describe("payout details changed", () => {
  it("blocks an invoice asking to be paid somewhere else", () => {
    const r = payoutChanged(eko(demoTronAddress("new-bank-details")), ctx());
    expect(r.status).toBe("block");
    expect(r.reason).toContain("Payout details changed");
    expect(r.reason).toContain("by phone");
  });

  it("passes when the printed address is the one on record", () => {
    expect(payoutChanged(eko(EKO.payout.address), ctx()).status).toBe("pass");
  });

  it("passes when the invoice prints no payment details", () => {
    expect(payoutChanged(eko(null), ctx()).status).toBe("pass");
  });

  it("compares EVM addresses without caring about letter case", () => {
    const base = { ...EKO, payout: { ...EKO.payout, address: "0xabcdef0000000000000000000000000000000001" } };
    const r = payoutChanged(
      inv({
        supplierName: "Eko Fresh Foods",
        lines: [],
        total: "1.00",
        payout: { chain: "base", token: "USDC", address: "0xABCDEF0000000000000000000000000000000001" },
      }),
      ctx({ payees: [base] }),
    );
    expect(r.status).toBe("pass");
  });
});
