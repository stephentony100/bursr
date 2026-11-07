import { demoEvmAddress, demoNearImplicit, demoSolanaAddress, demoTronAddress } from "./demo-addresses";
import type { PayoutToken, Rules } from "./domain";
import { USD_DECIMALS, parseUnits } from "./money";
import type { PayeeInput } from "./owner-actions";
import { findPayoutToken } from "./tokens";
import { readEnv } from "./env";

// DRY-RUN SAMPLE BUSINESS. A fictional Lagos restaurant. Every name is made up
// and every address is derived from a hash (lib/demo-addresses.ts), so nobody
// holds a key for any of them. Never used in live mode.

export const SAMPLE_NAME = "Bukka Corner Restaurant";

const usd = (text: string) => parseUnits(text, USD_DECIMALS).toString();

export function sampleRules(tokens: PayoutToken[]): Rules {
  const t = (symbol: string, chain: string) => findPayoutToken(tokens, symbol, chain);
  return {
    weeklyCapUsd: usd("2500"),
    perPaymentCapUsd: usd("900"),
    approvalThresholdUsd: usd("600"),
    treasury: t("USDC", "near"),
    payoutTokens: [t("USDC", "near"), t("USDT", "tron"), t("USDC", "base"), t("USDC", "sol")],
    paydayWeekday: 5, // Friday
    timeZone: "Africa/Lagos",
    frozen: false,
    // Practice mode: Bursar's fee goes to a made-up account (hash-derived; nobody holds its key).
    fee: readEnv().BURSAR_FEE_BPS > 0 ? { bps: readEnv().BURSAR_FEE_BPS, payout: { token: t("USDC", "near"), address: demoNearImplicit("bursar-fees"), memo: null } } : null,
  };
}

export function samplePayees(tokens: PayoutToken[]): PayeeInput[] {
  const t = (symbol: string, chain: string) => findPayoutToken(tokens, symbol, chain);
  const bps = 500; // 5% tolerance on agreed prices
  return [
    {
      name: "Mama Put Farms Ltd",
      category: "supplier",
      payout: { token: t("USDC", "near"), address: demoNearImplicit("mama-put-farms"), memo: null },
      prices: [
        { item: "Tomatoes (crate)", unitPriceUsd: usd("18"), toleranceBps: bps },
        { item: "Fresh pepper (bag)", unitPriceUsd: usd("12.5"), toleranceBps: bps },
        { item: "Onions (bag)", unitPriceUsd: usd("21"), toleranceBps: bps },
      ],
      recurring: null,
    },
    {
      name: "Eko Fresh Foods",
      category: "supplier",
      payout: { token: t("USDT", "tron"), address: demoTronAddress("eko-fresh-foods"), memo: null },
      prices: [
        { item: "Chicken (carton)", unitPriceUsd: usd("45"), toleranceBps: bps },
        { item: "Catfish (kg)", unitPriceUsd: usd("6"), toleranceBps: bps },
      ],
      recurring: null,
    },
    {
      name: "Ikeja Gas & Charcoal",
      category: "supplier",
      payout: { token: t("USDC", "base"), address: demoEvmAddress("ikeja-gas"), memo: null },
      prices: [{ item: "Cooking gas refill (12.5kg)", unitPriceUsd: usd("15"), toleranceBps: bps }],
      recurring: null,
    },
    {
      name: "Bisi Adeyemi (head chef)",
      category: "staff",
      payout: { token: t("USDC", "base"), address: demoEvmAddress("bisi-adeyemi"), memo: null },
      prices: [],
      recurring: { amountUsd: usd("220"), every: "week" },
    },
    {
      name: "Tunde Okafor (server)",
      category: "staff",
      payout: { token: t("USDT", "tron"), address: demoTronAddress("tunde-okafor"), memo: null },
      prices: [],
      recurring: { amountUsd: usd("110"), every: "week" },
    },
    {
      name: "Amaka Eze (cashier)",
      category: "staff",
      payout: { token: t("USDC", "sol"), address: demoSolanaAddress("amaka-eze"), memo: null },
      prices: [],
      recurring: { amountUsd: usd("120"), every: "week" },
    },
  ];
}

/** Demo funds in the simulated account: $6,000 of USDC on NEAR. */
export function sampleBalances(rules: Rules): Record<string, bigint> {
  return { [rules.treasury.assetId]: parseUnits("6000", rules.treasury.decimals) };
}
