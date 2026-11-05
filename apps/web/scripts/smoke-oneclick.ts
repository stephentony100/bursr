// Smoke test: one dry 1Click quote from USDC held in the agent's NEAR Intents
// balance to USDT on Tron, and one to USDC on Base. dry: true means no deposit
// address is created and nothing can be spent. Needs no keys.
import "./load-env";
import { demoEvmAddress, demoTronAddress } from "../lib/demo-addresses";
import { findToken, getQuote, getTokens, type Token } from "../lib/oneclick";
import { readEnv } from "../lib/env";

function fmt(amount: string, t: Token) {
  const s = amount.padStart(t.decimals + 1, "0");
  return `${s.slice(0, -t.decimals)}.${s.slice(-t.decimals)} ${t.symbol}`;
}

async function main() {
  const env = readEnv();
  const tokens = await getTokens();
  console.log(`GET /v0/tokens → ${tokens.length} tokens`);

  const usdcNear = findToken(tokens, "USDC", "near");
  const targets = [
    { token: findToken(tokens, "USDT", "tron"), recipient: demoTronAddress("smoke-tron") },
    { token: findToken(tokens, "USDC", "base"), recipient: demoEvmAddress("smoke-base") },
  ];
  console.log(`origin  ${usdcNear.symbol}@${usdcNear.blockchain}  ${usdcNear.assetId}`);

  for (const { token, recipient } of targets) {
    const amount = (50n * 10n ** BigInt(token.decimals)).toString(); // exactly 50 out
    const q = await getQuote({
      dry: true,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: env.ONECLICK_SLIPPAGE_BPS,
      originAsset: usdcNear.assetId,
      depositType: "INTENTS",
      destinationAsset: token.assetId,
      amount,
      refundTo: env.AGENT_ACCOUNT_ID ?? "bursar-demo.near",
      refundType: "INTENTS",
      recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 10 * 60_000).toISOString(),
      quoteWaitingTimeMs: 3000,
    });
    console.log(
      `\n→ ${token.symbol}@${token.blockchain}  ${token.assetId}\n` +
        `  payee receives ${fmt(q.quote.amountOut, token)}\n` +
        `  agent pays     ${fmt(q.quote.amountIn, usdcNear)} (min ${fmt(q.quote.minAmountIn ?? q.quote.amountIn, usdcNear)})\n` +
        `  withdraw fee   ${q.quote.withdrawFee ?? "n/a"} (smallest units)\n` +
        `  est. time      ${q.quote.timeEstimate ?? "?"}s   signed: ${q.signature ? "yes" : "no"}`,
    );
  }
  console.log("\nOK: dry quotes work. Nothing was deposited or spent.");
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e, (e as { body?: string }).body ?? "");
  process.exit(1);
});
