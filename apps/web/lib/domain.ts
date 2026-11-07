import { z } from "zod";

// Core business records. Amounts are integer strings; USD amounts use 6
// decimals (micro-dollars, see lib/money.ts).

const IntStr = z.string().regex(/^\d+$/, "integer amount in smallest units");

export const PayoutTokenSchema = z.object({
  assetId: z.string().min(1), // from /v0/tokens, never typed by hand
  symbol: z.enum(["USDC", "USDT"]), // stablecoins only: caps are set in USD
  chain: z.string().min(1), // 1Click / Agent API blockchain id, e.g. near, tron, base
  decimals: z.number().int().min(0).max(24),
});
export type PayoutToken = z.infer<typeof PayoutTokenSchema>;

export const RulesSchema = z
  .object({
    weeklyCapUsd: IntStr,
    perPaymentCapUsd: IntStr,
    approvalThresholdUsd: IntStr,
    /** What the agent holds and pays from. */
    treasury: PayoutTokenSchema,
    /** Tokens payees may be paid in. */
    payoutTokens: z.array(PayoutTokenSchema).min(1),
    paydayWeekday: z.number().int().min(0).max(6), // 0 = Sunday
    timeZone: z.string().min(1),
    frozen: z.boolean(),
    /** Bursar's own fee per plan, paid like any payee to an address on the signed list. null = no fee. */
    fee: z
      .object({ bps: z.number().int().min(1).max(500), payout: z.lazy(() => PayoutSchema) })
      .nullable()
      .default(null),
  })
  .refine((r) => BigInt(r.perPaymentCapUsd) <= BigInt(r.weeklyCapUsd), {
    message: "The per-payment cap cannot be larger than the weekly cap",
    path: ["perPaymentCapUsd"],
  })
  .refine((r) => BigInt(r.approvalThresholdUsd) <= BigInt(r.perPaymentCapUsd), {
    message: "The approval threshold cannot be larger than the per-payment cap",
    path: ["approvalThresholdUsd"],
  });
export type Rules = z.infer<typeof RulesSchema>;

export const PayeeCategory = z.enum(["supplier", "staff", "software"]);

export const PayoutSchema = z.object({
  token: PayoutTokenSchema,
  address: z.string().min(1),
  memo: z.string().nullable(),
});
export type Payout = z.infer<typeof PayoutSchema>;

export const PriceItemSchema = z.object({
  item: z.string().min(1),
  unitPriceUsd: IntStr,
  toleranceBps: z.number().int().min(0).max(10_000),
});
export type PriceItem = z.infer<typeof PriceItemSchema>;

export const PayeeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: PayeeCategory,
  payout: PayoutSchema,
  prices: z.array(PriceItemSchema),
  recurring: z.object({ amountUsd: IntStr, every: z.enum(["week", "month"]) }).nullable(),
  addedAt: z.string(), // ISO
  payoutChangedAt: z.string().nullable(), // ISO; starts the 48h hold
});
export type Payee = z.infer<typeof PayeeSchema>;

/** Hold after an owner changes a payee's payout details (the "bank details changed" fraud). */
export const PAYOUT_CHANGE_HOLD_MS = 48 * 60 * 60 * 1000;
/** Payees added recently need their own approval tap. */
export const NEW_PAYEE_MS = 7 * 24 * 60 * 60 * 1000;

export function payoutHoldEndsAt(p: Pick<Payee, "payoutChangedAt">): Date | null {
  return p.payoutChangedAt ? new Date(Date.parse(p.payoutChangedAt) + PAYOUT_CHANGE_HOLD_MS) : null;
}

export function isOnPayoutHold(p: Pick<Payee, "payoutChangedAt">, now: Date): boolean {
  const end = payoutHoldEndsAt(p);
  return end !== null && now < end;
}

export function isNewPayee(p: Pick<Payee, "addedAt">, now: Date): boolean {
  return now.getTime() - Date.parse(p.addedAt) < NEW_PAYEE_MS;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * EVM addresses must be lowercase hex in an Agent API policy ("EVM addresses
 * … must be lowercase hex"), and "`only` matches the exact entry". Detected by
 * format, not by a hand-kept list of chain ids. Other formats (Tron base58,
 * NEAR account ids) are case-sensitive or already lowercase and kept as is.
 */
export function normaliseAddress(address: string): string {
  const a = address.trim();
  return EVM_ADDRESS.test(a) ? a.toLowerCase() : a;
}
