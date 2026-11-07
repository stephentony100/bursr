import { demoNearImplicit } from "./demo-addresses";
import type { Payout, PayoutToken } from "./domain";
import { readEnv } from "./env";
import { rescale, USD_DECIMALS } from "./money";
import { getQuote } from "./oneclick";

// What paying someone costs, from a real 1Click DRY quote (no deposit address,
// nothing can be spent): USDC held in the agent's NEAR Intents balance →
// exactly the amount owed, in the payee's token, on the payee's chain.

export interface PayoutQuote {
  /** Treasury token the account would spend at most (includes the slippage allowance). */
  amountIn: string;
  /** Treasury token the account is expected to spend. */
  minAmountIn: string;
  /** Exactly what the payee receives, in their token's smallest units. */
  amountOut: string;
  /** Withdrawal fee, in the payee token's smallest units. */
  withdrawFee: string;
  timeEstimateSec: number;
  at: string;
}

export type QuoteResult = { ok: true; quote: PayoutQuote } | { ok: false; reason: string };

export function amountOutFor(amountUsd: bigint, token: PayoutToken): bigint {
  // Stablecoins only: $1 = 1 unit of the token.
  return rescale(amountUsd, USD_DECIMALS, token.decimals);
}

export async function quotePayout(treasury: PayoutToken, payout: Payout, amountUsd: bigint, refundTo?: string): Promise<QuoteResult> {
  const env = readEnv();
  try {
    const q = await getQuote({
      dry: true,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: env.ONECLICK_SLIPPAGE_BPS,
      originAsset: treasury.assetId,
      depositType: "INTENTS",
      destinationAsset: payout.token.assetId,
      amount: amountOutFor(amountUsd, payout.token).toString(),
      // Dry quotes only: in practice mode the refund account is a hash-derived placeholder.
      refundTo: refundTo ?? demoNearImplicit("bursar-agent"),
      refundType: "INTENTS",
      recipient: payout.address,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      quoteWaitingTimeMs: 3000,
    });
    return {
      ok: true,
      quote: {
        amountIn: q.quote.amountIn,
        minAmountIn: q.quote.minAmountIn ?? q.quote.amountIn,
        amountOut: q.quote.amountOut,
        withdrawFee: q.quote.withdrawFee ?? "0",
        timeEstimateSec: q.quote.timeEstimate ?? 60,
        at: new Date().toISOString(),
      },
    };
  } catch (e) {
    const body = (e as { body?: string }).body;
    let message = e instanceof Error ? e.message : String(e);
    try {
      message = (JSON.parse(body ?? "") as { message?: string }).message ?? message;
    } catch {
      /* keep the HTTP message */
    }
    return { ok: false, reason: `No price quote: ${message}` };
  }
}
