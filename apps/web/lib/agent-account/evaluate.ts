import type { Policy } from "@near-intents-agent-api/sdk";
import { normaliseAddress } from "../domain";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "../money";

// Dry-run stand-in for the agent account's rule check. It applies the same
// Agent API policy, with the same refusal codes, so the app behaves the same
// in dry-run and live. In live mode this is NOT used as a gate: the Agent API
// and its wallet provider refuse on their own. Semantics follow
// docs.agentsonintents.com …/policies-and-limits:
//   - "frozen true stops every action"
//   - destinations "`only` matches the exact entry, memo included"
//   - weekly_usd: "7 days, repeating from that moment" the cap was turned on;
//     "Periods are fixed, not rolling"
//   - per_transaction is a per-asset cap in atomic units

export type ActionRequest =
  | { kind: "withdraw"; asset: string; amount: bigint; chain: string; recipient: string; memo?: string | null }
  | { kind: "transfer"; asset: string; amount: bigint; recipient: string }
  | { kind: "swap"; asset: string; amount: bigint; destinationAsset: string };

export interface SpendRecord {
  at: Date;
  usdMicros: bigint;
}

export interface AccountState {
  policy: Policy;
  /** When the weekly cap was turned on; its 7-day periods count from here. */
  budgetStartedAt: Date;
  /** Counted spending (withdrawals and transfers; swaps stay in the account). */
  spends: SpendRecord[];
  balances: Record<string, bigint>;
  /** Decimals per asset id, from the token list. All allowed assets are USD stablecoins. */
  decimals: Record<string, number>;
}

export type RefusalCode =
  | "wallet_frozen"
  | "policy_action_denied"
  | "policy_asset_denied"
  | "policy_transaction_limit_exceeded"
  | "policy_destination_denied"
  | "spend_budget_exceeded"
  | "insufficient_balance"
  | "unsupported_token";

export interface Refusal {
  code: RefusalCode;
  /** Which part of the account refused, as the Agent API reports it. */
  layer: "policy" | "budget" | "balance" | "request";
  /** Plain English, for the owner. */
  message: string;
}

export type Verdict = { ok: true; usdMicros: bigint } | { ok: false; refusal: Refusal };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function weekPeriodStart(startedAt: Date, now: Date): Date {
  const n = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / WEEK_MS));
  return new Date(startedAt.getTime() + n * WEEK_MS);
}

export function spentThisWeek(state: AccountState, now: Date): bigint {
  const start = weekPeriodStart(state.budgetStartedAt, now).getTime();
  return state.spends.filter((s) => s.at.getTime() >= start && s.at <= now).reduce((a, s) => a + s.usdMicros, 0n);
}

function refuse(code: RefusalCode, layer: Refusal["layer"], message: string): Verdict {
  return { ok: false, refusal: { code, layer, message } };
}

export function evaluate(state: AccountState, req: ActionRequest, now: Date): Verdict {
  const { policy } = state;
  const decimals = state.decimals[req.asset];
  if (decimals === undefined) return refuse("unsupported_token", "request", "Bursr can't pay in this currency.");
  if (req.amount <= 0n) return refuse("unsupported_token", "request", "The amount must be more than zero.");

  if (policy.frozen) {
    return refuse("wallet_frozen", "policy", "Payments are paused. Nothing can go out until you turn them back on.");
  }
  if (!policy.actions.includes(req.kind)) {
    return refuse("policy_action_denied", "policy", "Your spending rules don't allow this kind of payment.");
  }
  if (policy.assets !== "any" && !policy.assets.includes(req.asset)) {
    return refuse("policy_asset_denied", "policy", "Your spending rules don't allow paying in this currency.");
  }
  if (req.kind === "swap" && policy.assets !== "any" && !policy.assets.includes(req.destinationAsset)) {
    return refuse("policy_asset_denied", "policy", "Your spending rules don't allow paying in this currency.");
  }

  const cap = policy.limits.per_transaction?.[req.asset];
  if (cap !== undefined && req.amount > BigInt(cap)) {
    const capUsd = rescale(BigInt(cap), decimals, USD_DECIMALS);
    return refuse(
      "policy_transaction_limit_exceeded",
      "policy",
      `This is more than your ${formatUsd(capUsd)} limit for a single payment.`,
    );
  }

  if (req.kind !== "swap") {
    const { mode, list } = policy.destinations;
    const matches = list.some((d) =>
      req.kind === "withdraw"
        ? "chain" in d &&
          d.action === "withdraw" &&
          d.chain === req.chain &&
          d.address === normaliseAddress(req.recipient) &&
          d.memo === (req.memo ?? null)
        : "confidential" in d && d.action === "transfer" && d.address === req.recipient,
    );
    const allowed = mode === "any" || (mode === "only" ? matches : !matches);
    if (!allowed) {
      return refuse(
        "policy_destination_denied",
        "policy",
        "This wallet isn't one of the people you pay. Only you can add someone new.",
      );
    }
  }

  // Stablecoins only, so the USD value is the amount at USD precision.
  const usdMicros = rescale(req.amount, decimals, USD_DECIMALS);

  const weekly = policy.budget.weekly_usd;
  if (weekly !== null && req.kind !== "swap") {
    const capMicros = parseUnits(weekly, USD_DECIMALS);
    const spent = spentThisWeek(state, now);
    if (spent + usdMicros > capMicros) {
      const left = capMicros > spent ? capMicros - spent : 0n;
      return refuse(
        "spend_budget_exceeded",
        "budget",
        `This would go over your weekly limit of ${formatUsd(capMicros)} (${formatUsd(left)} left this week).`,
      );
    }
  }

  const balance = state.balances[req.asset] ?? 0n;
  if (req.amount > balance) {
    return refuse("insufficient_balance", "balance", "There isn't enough money in your Bursr wallet for this payment.");
  }

  return { ok: true, usdMicros };
}
