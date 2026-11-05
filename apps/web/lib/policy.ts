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

export function buildPolicy(rules: Rules, payees: Payee[]): Policy {
  const tokens = [rules.treasury, ...payees.map((p) => p.payout.token)];
  const byAsset = new Map(tokens.map((t) => [t.assetId, t]));

  // Caps are set in USD; every allowed token is a USD stablecoin, so the cap
  // in a token's atomic units is the USD amount rescaled to its decimals.
  const perTransaction: Record<string, string> = {};
  for (const [assetId, t] of byAsset) {
    perTransaction[assetId] = rescale(BigInt(rules.perPaymentCapUsd), USD_DECIMALS, t.decimals).toString();
  }

  const seen = new Set<string>();
  const list = payees
    .map(destinationFor)
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
    max_actions_per_hour: 30,
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
