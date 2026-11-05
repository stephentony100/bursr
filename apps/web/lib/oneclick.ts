import { z } from "zod";
import { readEnv } from "./env";
import { fetchJson } from "./http";

// NEAR Intents 1Click API client. Endpoints and fields per
// https://docs.near-intents.org/integration/distribution-channels/1click-api
// (see docs/DECISIONS.md for the quoted lines). Asset IDs are never typed by
// hand: they come from GET /v0/tokens.

export const TokenSchema = z.looseObject({
  assetId: z.string(),
  decimals: z.number().int(),
  blockchain: z.string(),
  symbol: z.string(),
  price: z.union([z.string(), z.number()]).optional(),
  priceUpdatedAt: z.string().optional(),
  contractAddress: z.string().optional(),
});
export type Token = z.infer<typeof TokenSchema>;

export const SwapType = z.enum(["EXACT_INPUT", "EXACT_OUTPUT", "FLEX_INPUT", "ANY_INPUT"]);

export const QuoteRequestSchema = z.object({
  dry: z.boolean(),
  swapType: SwapType,
  slippageTolerance: z.number().int(),
  originAsset: z.string(),
  depositType: z.enum(["ORIGIN_CHAIN", "INTENTS", "CONFIDENTIAL_INTENTS"]),
  destinationAsset: z.string(),
  amount: z.string().regex(/^\d+$/, "amount must be an integer string in smallest units"),
  refundTo: z.string(),
  refundType: z.enum(["ORIGIN_CHAIN", "INTENTS", "CONFIDENTIAL_INTENTS"]),
  recipient: z.string(),
  recipientType: z.enum(["DESTINATION_CHAIN", "INTENTS", "CONFIDENTIAL_INTENTS"]),
  deadline: z.string(),
  referral: z.string().optional(),
  quoteWaitingTimeMs: z.number().int().optional(),
  appFees: z.array(z.object({ recipient: z.string(), fee: z.number().int() })).optional(),
  confidentiality: z.enum(["public", "basic", "advanced"]).optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

export const QuoteResponseSchema = z.looseObject({
  correlationId: z.string().optional(),
  timestamp: z.string().optional(),
  signature: z.string().optional(),
  quote: z.looseObject({
    depositAddress: z.string().optional(),
    depositMemo: z.string().nullable().optional(),
    amountIn: z.string(),
    amountInFormatted: z.string().optional(),
    minAmountIn: z.string().optional(),
    maxAmountIn: z.string().optional(),
    amountOut: z.string(),
    amountOutFormatted: z.string().optional(),
    minAmountOut: z.string().optional(),
    deadline: z.string().optional(),
    timeEstimate: z.number().optional(),
    withdrawFee: z.string().optional(),
    refundFee: z.string().optional(),
  }),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

export const SwapStatus = z.enum([
  "PENDING_DEPOSIT",
  "KNOWN_DEPOSIT_TX",
  "PROCESSING",
  "SUCCESS",
  "INCOMPLETE_DEPOSIT",
  "REFUNDED",
  "FAILED",
]);
export type SwapStatus = z.infer<typeof SwapStatus>;
export const TERMINAL_STATUSES: ReadonlySet<SwapStatus> = new Set([
  "SUCCESS",
  "INCOMPLETE_DEPOSIT",
  "REFUNDED",
  "FAILED",
]);

export const StatusResponseSchema = z.looseObject({
  correlationId: z.string().optional(),
  status: SwapStatus,
  updatedAt: z.string().optional(),
  swapDetails: z
    .looseObject({
      nearTxHashes: z.array(z.string()).optional(),
      destinationChainTxHashes: z.array(z.object({ hash: z.string(), explorerUrl: z.string() })).optional(),
      refundReason: z.string().optional(),
    })
    .optional(),
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

function headers(): Record<string, string> {
  const { ONECLICK_API_KEY } = readEnv();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  // OpenAPI: "X-API-Key ... API key for partner authentication (recommended)";
  // Authorization: Bearer is "legacy".
  if (ONECLICK_API_KEY) h["X-API-Key"] = ONECLICK_API_KEY;
  return h;
}

const base = () => readEnv().ONECLICK_BASE_URL.replace(/\/$/, "");

export async function getTokens(): Promise<Token[]> {
  return fetchJson(`${base()}/v0/tokens`, z.array(TokenSchema), { headers: headers() });
}

/** Finds a token by symbol and chain; throws if it is missing or ambiguous. */
export function findToken(tokens: Token[], symbol: string, blockchain: string): Token {
  const hits = tokens.filter(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase() && t.blockchain === blockchain,
  );
  if (hits.length !== 1) {
    throw new Error(`Expected exactly one ${symbol} on ${blockchain} in /v0/tokens, found ${hits.length}`);
  }
  return hits[0];
}

export async function getQuote(req: QuoteRequest): Promise<QuoteResponse> {
  const body = QuoteRequestSchema.parse(req);
  return fetchJson(`${base()}/v0/quote`, QuoteResponseSchema, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    timeoutMs: 30_000,
  });
}

export async function getStatus(depositAddress: string, depositMemo?: string): Promise<StatusResponse> {
  const q = new URLSearchParams({ depositAddress });
  if (depositMemo) q.set("depositMemo", depositMemo);
  return fetchJson(`${base()}/v0/status?${q}`, StatusResponseSchema, { headers: headers() });
}
