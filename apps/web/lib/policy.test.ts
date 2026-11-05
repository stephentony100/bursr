import { describe, expect, it } from "vitest";
import { buildPolicy } from "./policy";
import { BASE_PAYEE, NEAR_PAYEE, TRON_PAYEE, USDC_NEAR, USDT_TRON, rules, usd } from "./test-fixtures";

describe("buildPolicy", () => {
  const policy = buildPolicy(rules(), [NEAR_PAYEE, TRON_PAYEE, BASE_PAYEE]);

  it("allows only the listed payees, exactly", () => {
    expect(policy.destinations.mode).toBe("only");
    expect(policy.destinations.list).toHaveLength(3);
    expect(policy.destinations.list).toContainEqual({
      action: "withdraw",
      chain: "tron",
      address: TRON_PAYEE.payout.address,
      memo: null,
    });
  });

  it("stores EVM addresses lowercase (the API matches the exact entry)", () => {
    const base = policy.destinations.list.find((d) => "chain" in d && d.chain === "base");
    expect(base && "address" in base ? base.address : "").toBe(BASE_PAYEE.payout.address.toLowerCase());
    expect(BASE_PAYEE.payout.address).not.toBe(BASE_PAYEE.payout.address.toLowerCase());
  });

  it("sets the weekly cap as a USD budget and the per-payment cap per asset", () => {
    expect(policy.budget).toEqual({ daily_usd: null, weekly_usd: "1000", monthly_usd: null });
    expect(policy.limits.per_transaction?.[USDC_NEAR.assetId]).toBe(usd(400));
    expect(policy.limits.per_transaction?.[USDT_TRON.assetId]).toBe(usd(400));
  });

  it("allows only the treasury and payee tokens", () => {
    expect(policy.assets).toEqual([BASE_PAYEE, NEAR_PAYEE, TRON_PAYEE].map((p) => p.payout.token.assetId).sort());
  });

  it("never enables native methods and never allows plain transfers", () => {
    expect(policy).not.toHaveProperty("native");
    expect(policy.actions).toEqual(["swap", "withdraw"]);
  });

  it("carries the freeze switch", () => {
    expect(buildPolicy(rules({ frozen: true }), []).frozen).toBe(true);
  });

  it("with no payees, money can go nowhere", () => {
    expect(buildPolicy(rules(), []).destinations).toEqual({ mode: "only", list: [] });
  });

  it("does not list the same destination twice", () => {
    expect(buildPolicy(rules(), [NEAR_PAYEE, { ...NEAR_PAYEE, id: "dup" }]).destinations.list).toHaveLength(1);
  });
});
