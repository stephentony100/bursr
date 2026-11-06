import snapshot from "../../../fixtures/tokens.snapshot.json";
import type { PayoutToken } from "./domain";
import { getTokens, type Token } from "./oneclick";

// Payout tokens come from 1Click's GET /v0/tokens. If it cannot be reached,
// dry-run falls back to fixtures/tokens.snapshot.json (saved from the same
// endpoint on 5 Nov 2026), so the demo works offline.

export const CHAIN_NAMES: Record<string, string> = {
  near: "NEAR",
  tron: "Tron",
  base: "Base",
  arb: "Arbitrum",
  sol: "Solana",
  eth: "Ethereum",
  pol: "Polygon",
  bsc: "BNB Chain",
  op: "Optimism",
  avax: "Avalanche",
};

export const chainName = (id: string) => CHAIN_NAMES[id] ?? id.toUpperCase();

/** USDC and USDT, one entry per chain; any symbol+chain listed twice is left out rather than guessed. */
export function stablecoinsFrom(tokens: Token[]): PayoutToken[] {
  const stable = tokens.filter((t) => t.symbol === "USDC" || t.symbol === "USDT");
  const count = new Map<string, number>();
  for (const t of stable) count.set(`${t.symbol}@${t.blockchain}`, (count.get(`${t.symbol}@${t.blockchain}`) ?? 0) + 1);
  return stable
    .filter((t) => count.get(`${t.symbol}@${t.blockchain}`) === 1 && t.blockchain in CHAIN_NAMES)
    .map((t) => ({ assetId: t.assetId, symbol: t.symbol as "USDC" | "USDT", chain: t.blockchain, decimals: t.decimals }))
    .sort((a, b) => (a.chain === "near" ? -1 : b.chain === "near" ? 1 : a.chain.localeCompare(b.chain) || a.symbol.localeCompare(b.symbol)));
}

let cache: { at: number; tokens: PayoutToken[] } | null = null;

export async function payoutTokens(): Promise<PayoutToken[]> {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache.tokens;
  let tokens: PayoutToken[];
  try {
    tokens = stablecoinsFrom(await getTokens());
  } catch {
    tokens = stablecoinsFrom(snapshot as Token[]);
  }
  cache = { at: Date.now(), tokens };
  return tokens;
}

export function findPayoutToken(tokens: PayoutToken[], symbol: string, chain: string): PayoutToken {
  const t = tokens.find((x) => x.symbol === symbol && x.chain === chain);
  if (!t) throw new Error(`${symbol} on ${chainName(chain)} is not available`);
  return t;
}
