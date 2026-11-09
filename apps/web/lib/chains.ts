// Network names for people (no server code here, so pages in the browser can use it too).

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
  sui: "Sui",
};

export const chainName = (id: string) => CHAIN_NAMES[id] ?? id.toUpperCase();
