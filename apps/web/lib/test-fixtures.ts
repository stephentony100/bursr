// Shared test data. Asset ids are the ones GET /v0/tokens returned on
// 5 Nov 2026 (docs/DECISIONS.md B2); app code always looks them up live.
import type { Payee, PayoutToken, Rules } from "./domain";
import { demoEvmAddress, demoTronAddress } from "./demo-addresses";

export const USDC_NEAR: PayoutToken = {
  assetId: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  symbol: "USDC",
  chain: "near",
  decimals: 6,
};
export const USDT_TRON: PayoutToken = {
  assetId: "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near",
  symbol: "USDT",
  chain: "tron",
  decimals: 6,
};
export const USDC_BASE: PayoutToken = {
  assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
  symbol: "USDC",
  chain: "base",
  decimals: 6,
};

export const usd = (dollars: number) => (BigInt(dollars) * 1_000_000n).toString();

export function rules(over: Partial<Rules> = {}): Rules {
  return {
    weeklyCapUsd: usd(1000),
    perPaymentCapUsd: usd(400),
    approvalThresholdUsd: usd(250),
    treasury: USDC_NEAR,
    payoutTokens: [USDC_NEAR, USDT_TRON, USDC_BASE],
    paydayWeekday: 5,
    timeZone: "Africa/Lagos",
    frozen: false,
    autopilot: true,
    invoiceTiming: "due",
    fee: null,
    ...over,
  };
}

export function payee(over: Partial<Payee> & { id: string }): Payee {
  return {
    name: over.id,
    category: "supplier",
    payout: { token: USDC_NEAR, address: `${over.id}.near`, memo: null },
    prices: [],
    recurring: null,
    addedAt: "2026-10-01T00:00:00.000Z",
    payoutChangedAt: null,
    trustedAt: over.trustedAt !== undefined ? over.trustedAt : (over.addedAt ?? "2026-10-01T00:00:00.000Z"),
    ...over,
  };
}

export const TRON_PAYEE = payee({
  id: "tron-supplier",
  payout: { token: USDT_TRON, address: demoTronAddress("tron-supplier"), memo: null },
});
export const BASE_PAYEE = payee({
  id: "base-staff",
  category: "staff",
  // Mixed case on purpose: the policy must store it lowercase.
  payout: { token: USDC_BASE, address: "0x" + demoEvmAddress("base-staff").slice(2).toUpperCase(), memo: null },
});
export const NEAR_PAYEE = payee({ id: "farm" });
