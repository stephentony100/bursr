import { createHash } from "node:crypto";
import type { Policy } from "@near-intents-agent-api/sdk";
import type { PayoutToken } from "./domain";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "./money";
import type { Refusal } from "./agent-account/evaluate";

// The pure half of the Stellar edition: how Bursr's rules (the same Policy
// JSON the NEAR edition signs) become the vault contract's arguments, and how
// the contract's refusals become plain words. No network here.
// Contract: contracts/bursr-stellar-vault (error numbers are its interface).

/** Circle's USDC on Stellar testnet: its Stellar Asset Contract (developers.circle.com, `stellar contract id asset`). */
export const STELLAR_USDC_CONTRACT = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
export const STELLAR_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

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
} as const;

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

export const stellarExpertTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const stellarExpertContract = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;
