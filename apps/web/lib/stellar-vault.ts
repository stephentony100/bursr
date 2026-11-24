import { createHash } from "node:crypto";
import type { Policy } from "@near-intents-agent-api/sdk";
import type { PayoutToken } from "./domain";
import { stellarNetwork } from "./stellar-network";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "./money";
import type { Refusal } from "./agent-account/evaluate";

// The pure half of the Stellar edition: how Bursr's rules (the same Policy
// JSON the NEAR edition signs) become the vault contract's arguments, and how
// the contract's refusals become plain words. No network here.
// Contract: contracts/bursr-stellar-vault (error numbers are its interface).

/** Circle's USDC on this build's Stellar network: its Stellar Asset Contract and issuer (lib/stellar-network.ts). */
export const STELLAR_USDC_CONTRACT = stellarNetwork().usdcContract;
export const STELLAR_USDC_ISSUER = stellarNetwork().usdcIssuer;

export const STELLAR_USDC: PayoutToken = {
  assetId: `stellar:${STELLAR_USDC_CONTRACT}`,
  symbol: "USDC",
  chain: "stellar",
  decimals: 7,
};

export interface VaultLimits {
  perPaymentCap: bigint;
  weeklyCap: bigint;
  frozen: boolean;
  /** G-addresses the agent may pay. */
  payees: string[];
}

/** What the vault should hold for this policy. Caps are in USDC's smallest units (7 decimals). */
export function vaultLimits(policy: Policy, token: PayoutToken = STELLAR_USDC): VaultLimits {
  const per = policy.limits.per_transaction?.[token.assetId];
  if (per === undefined) throw new Error("Your rules have no single-payment limit for USDC on Stellar.");
  const weekly = policy.budget.weekly_usd;
  if (weekly === null) throw new Error("Your rules have no weekly limit.");
  const payees = [
    ...new Set(policy.destinations.list.filter((d) => "chain" in d && d.chain === token.chain).map((d) => d.address)),
  ];
  return { perPaymentCap: BigInt(per), weeklyCap: parseUnits(weekly, token.decimals), frozen: policy.frozen, payees };
}

/** The payee changes that turn the vault's list (`have`) into the owner's list (`want`). */
export function payeeDiff(want: string[], have: string[]): { add: string[]; remove: string[] } {
  const w = new Set(want);
  const h = new Set(have);
  return { add: [...w].filter((a) => !h.has(a)), remove: [...h].filter((a) => !w.has(a)) };
}

/** The contract's error numbers (contracts/bursr-stellar-vault, `enum Error`). */
export const VAULT_ERRORS = {
  BadAmount: 1,
  AlreadyPaid: 2,
  Frozen: 3,
  NotPayee: 4,
  OverPaymentCap: 5,
  OverWeeklyCap: 6,
  LowBalance: 7,
  BadLimits: 8,
  OverMaxBalance: 9,
} as const;

/** The vault's `MAX_BALANCE`: 500 USDC at 7 decimals, until the contract is reviewed. */
export const VAULT_MAX_BALANCE = 5_000_000_000n;

/** Plain words for a refusal from the vault, using the same codes and sentences as the NEAR edition. */
export function refusalForVaultError(code: number, ctx: { perPaymentCap?: bigint; weeklyCap?: bigint; spent?: bigint; decimals?: number } = {}): Refusal {
  const usd = (v: bigint | undefined) => (v === undefined ? null : formatUsd(rescale(v, ctx.decimals ?? STELLAR_USDC.decimals, USD_DECIMALS)));
  switch (code) {
    case VAULT_ERRORS.Frozen:
      return { code: "wallet_frozen", layer: "policy", message: "Payments are paused. Nothing can go out until you turn them back on." };
    case VAULT_ERRORS.NotPayee:
      return { code: "policy_destination_denied", layer: "policy", message: "This wallet isn't one of the people you pay. Only you can add someone new." };
    case VAULT_ERRORS.OverPaymentCap: {
      const cap = usd(ctx.perPaymentCap);
      return { code: "policy_transaction_limit_exceeded", layer: "policy", message: cap ? `This is more than your ${cap} limit for a single payment.` : "This is more than your limit for a single payment." };
    }
    case VAULT_ERRORS.OverWeeklyCap: {
      const cap = usd(ctx.weeklyCap);
      const left = ctx.weeklyCap !== undefined && ctx.spent !== undefined ? usd(ctx.weeklyCap > ctx.spent ? ctx.weeklyCap - ctx.spent : 0n) : null;
      return {
        code: "spend_budget_exceeded",
        layer: "budget",
        message: cap ? `This would go over your weekly limit of ${cap}${left ? ` (${left} left this week)` : ""}.` : "This would go over your weekly limit.",
      };
    }
    case VAULT_ERRORS.LowBalance:
      return { code: "insufficient_balance", layer: "balance", message: "There isn't enough money in your Bursr wallet for this payment." };
    case VAULT_ERRORS.OverMaxBalance:
      return {
        code: "insufficient_balance",
        layer: "balance",
        message: `Your Bursr wallet can hold up to ${usd(VAULT_MAX_BALANCE)} while its safety contract is being reviewed. Add less.`,
      };
    default:
      return { code: "unsupported_token", layer: "request", message: "Bursr can't make this payment (the amount isn't valid)." };
  }
}

/** The vault's no-double-pay key for one Bursr payment step: sha256 of Bursr's idempotency key. */
export function paymentKey(idempotencyKey: string): Buffer {
  return createHash("sha256").update(idempotencyKey, "utf8").digest();
}

/** Pulls the vault's error number out of a Soroban simulation or transaction error ("Error(Contract, #4)"). */
export function vaultErrorCode(message: string): number | null {
  const m = /Error\(Contract, #(\d+)\)/.exec(message);
  return m ? Number(m[1]) : null;
}

export const stellarExpertTx = (hash: string) => `${stellarNetwork().explorer}/tx/${hash}`;
export const stellarExpertContract = (id: string) => `${stellarNetwork().explorer}/contract/${id}`;

/** XLM and USDC both have 7 decimals on Stellar; amounts here are in those units. */
export type TestUsdcPlan =
  | { mode: "receive"; usdc: bigint; xlmMax: bigint }
  | { mode: "send"; xlm: bigint; usdcMin: bigint; usdcExpected: bigint }
  | { mode: "none"; reason: string };

const XLM = 10_000_000n;

/** The XLM a wallet can spend: its balance less the network's minimum balance ((2 + entries) × 0.5 XLM) and 1 XLM kept for fees. */
export function spendableXlm(balance: bigint, subentries: number, addsTrustline: boolean): bigint {
  const reserve = (BigInt(2 + subentries + (addsTrustline ? 1 : 0)) * XLM) / 2n;
  const left = balance - reserve - XLM;
  return left > 0n ? left : 0n;
}

/**
 * How to get test USDC with the wallet's test XLM: the full amount when it can
 * afford it (10% price headroom), otherwise whatever its spendable XLM buys.
 * `xlmForWanted`: the exchange's price in XLM for the wanted USDC; `usdcForSpendable`: what all the spendable XLM would buy.
 */
export function planTestUsdc(p: { spendable: bigint; wanted: bigint; xlmForWanted: bigint | null; usdcForSpendable: bigint | null }): TestUsdcPlan {
  if (p.spendable < XLM) return { mode: "none", reason: "Your wallet has too little test XLM to buy test USDC. Get test USDC from Circle's faucet instead." };
  if (p.xlmForWanted !== null) {
    const max = (p.xlmForWanted * 11n) / 10n;
    if (max <= p.spendable) return { mode: "receive", usdc: p.wanted, xlmMax: max };
  }
  if (p.usdcForSpendable === null || p.usdcForSpendable < XLM / 2n) {
    return { mode: "none", reason: "The test exchange can't sell test USDC for your test XLM right now. Get test USDC from Circle's faucet instead." };
  }
  return { mode: "send", xlm: p.spendable, usdcMin: (p.usdcForSpendable * 95n) / 100n, usdcExpected: p.usdcForSpendable };
}
