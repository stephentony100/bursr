import { describe, expect, it } from "vitest";
import { homeFor } from "./home";
import { buildPolicy } from "./policy";
import { BASE_PAYEE, NEAR_PAYEE, TRON_PAYEE, USDC_NEAR, USDT_TRON, rules, usd } from "./test-fixtures";

const USDC_SUI = { assetId: "nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near", symbol: "USDC" as const, chain: "sui", decimals: 6 };

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

  it("puts the owner's own wallet on the list: a NEAR account in the treasury token, a Sui address in USDC on Sui", () => {
    const near = buildPolicy(rules(), [], homeFor(rules(), "owner.near", USDC_SUI));
    expect(near.destinations.list).toEqual([{ action: "withdraw", chain: rules().treasury.chain, address: "owner.near", memo: null }]);
    expect(near.assets).toEqual([rules().treasury.assetId]);

    const addr = `0x${"ab".repeat(32)}`;
    const sui = buildPolicy(rules(), [], homeFor(rules(), `sui:${addr}`, USDC_SUI));
    expect(sui.destinations.list).toEqual([{ action: "withdraw", chain: "sui", address: addr, memo: null }]);
    expect(sui.assets).toContain(USDC_SUI.assetId);
    expect(sui.limits?.per_transaction?.[USDC_SUI.assetId]).toBeDefined();
    // Never the raw owner ID on NEAR, and nothing at all without the Sui token.
    expect(JSON.stringify(sui.destinations)).not.toContain("sui:");
    expect(homeFor(rules(), `sui:${addr}`, null)).toBeNull();
  });
});
