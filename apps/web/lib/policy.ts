import type { Policy } from "@near-intents-agent-api/sdk";
import { normaliseAddress, type Payee, type Rules } from "./domain";
import { formatUnits, rescale, USD_DECIMALS } from "./money";

// Turns the owner's rules and payee list into the Agent API policy the owner
// signs. This is the only place rules become enforceable: after signing, the
// agent account (not Bursar, not the AI) refuses anything outside it.
// Field meanings: docs.agentsonintents.com …/policies-and-limits.

export function destinationFor(p: Payee): Policy["destinations"]["list"][number] {
  return {
    action: "withdraw",
    chain: p.payout.token.chain,
    address: normaliseAddress(p.payout.address),
    memo: p.payout.memo,
  };
}

/** The owner's own NEAR account, where "Move money back to my wallet" sends the treasury token. */
export function homeDestination(rules: Rules, ownerAccountId: string) {
  return { action: "withdraw" as const, chain: rules.treasury.chain, address: normaliseAddress(ownerAccountId), memo: null };
}

export function buildPolicy(rules: Rules, payees: Payee[], ownerAccountId?: string): Policy {
  const tokens = [rules.treasury, ...payees.map((p) => p.payout.token), ...(rules.fee ? [rules.fee.payout.token] : [])];
  const byAsset = new Map(tokens.map((t) => [t.assetId, t]));

  // Caps are set in USD; every allowed token is a USD stablecoin, so the cap
  // in a token's atomic units is the USD amount rescaled to its decimals.
  const perTransaction: Record<string, string> = {};
  for (const [assetId, t] of byAsset) {
    perTransaction[assetId] = rescale(BigInt(rules.perPaymentCapUsd), USD_DECIMALS, t.decimals).toString();
  }

  const seen = new Set<string>();
  const feeDestination = rules.fee
    ? [{ action: "withdraw" as const, chain: rules.fee.payout.token.chain, address: normaliseAddress(rules.fee.payout.address), memo: rules.fee.payout.memo }]
    : [];
  // The owner can always move money back to their own account: it's on the list they sign.
  const home = ownerAccountId ? [homeDestination(rules, ownerAccountId)] : [];
  const list = [...payees.map(destinationFor), ...feeDestination, ...home]
    .filter((d) => {
      const key = JSON.stringify(d);
      return seen.has(key) ? false : (seen.add(key), true);
    });

  return {
    frozen: rules.frozen,
    actions: ["swap", "withdraw"],
    confidential: true,
    owner_approval: false,
    assets: [...byAsset.keys()].sort(),
    limits: { per_transaction: perTransaction },
    // Each payment is up to two actions (exchange, then send), plus room for retries and Bursar's fee.
    // The wallet also caps custody operations at 1,000 a day (Agent API network-and-quotas).
    max_actions_per_hour: Math.min(1000, Math.max(30, list.length * 3)),
    destinations: { mode: "only", list },
    budget: {
      daily_usd: null,
      weekly_usd: formatUnits(BigInt(rules.weeklyCapUsd), USD_DECIMALS),
      monthly_usd: null,
    },
    timelock_ms: 0,
    // `native` is deliberately absent: native methods bypass destinations and
    // budget ("destinations, budget, timelock_ms, schedule and owner_approval
    // don't apply"), so Bursar never enables them.
  };
}
