import type { PayoutToken, Rules } from "./domain";
import { parseUnits, USD_DECIMALS } from "./money";
import { findPayoutToken } from "./tokens";
import { readEnv } from "./env";

/** Live mode's first rules: deliberately tiny caps. The owner can raise them later. */
export function starterRules(tokens: PayoutToken[]): Rules {
  const t = (symbol: string, chain: string) => findPayoutToken(tokens, symbol, chain);
  const usd = (s: string) => parseUnits(s, USD_DECIMALS).toString();
  return {
    weeklyCapUsd: usd("20"),
    perPaymentCapUsd: usd("10"),
    approvalThresholdUsd: usd("5"),
    treasury: t("USDC", "near"),
    payoutTokens: [t("USDC", "near"), t("USDT", "tron"), t("USDC", "base")],
    paydayWeekday: 5,
    timeZone: "Africa/Lagos",
    frozen: false,
    // Live: only with an explicit fee account (a NEAR account that receives USDC).
    fee: (() => {
      const env = readEnv();
      return env.BURSAR_FEE_BPS > 0 && env.BURSAR_FEE_ACCOUNT_ID
        ? { bps: env.BURSAR_FEE_BPS, payout: { token: t("USDC", "near"), address: env.BURSAR_FEE_ACCOUNT_ID, memo: null } }
        : null;
    })(),
  };
}
