import { z } from "zod";
import { readEnv } from "./env";
import { fetchJson } from "./http";

// A NEAR account can only receive a token (USDC, USDT…) after it has been
// registered with that token's contract once (NEP-145 storage). The Agent API
// does not do it for the recipient: on 9 Nov 2026 a withdrawal of USDC to an
// unregistered account was refused with `invalid_address`.

const RpcResult = z.object({
  result: z.object({ result: z.array(z.number()) }).optional(),
  error: z.unknown().optional(),
});

/** "nep141:<contract>" → "<contract>"; anything else → null. */
export function nep141Contract(assetId: string): string | null {
  return assetId.startsWith("nep141:") ? assetId.slice("nep141:".length) : null;
}

/** true / false from the chain; null when the chain couldn't be asked (don't block on that). */
export async function canReceiveOnNear(assetId: string, accountId: string, rpcUrl = readEnv().NEAR_RPC_URL): Promise<boolean | null> {
  const contract = nep141Contract(assetId);
  if (!contract) return null;
  try {
    const res = await fetchJson(rpcUrl, RpcResult, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bursar",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: contract,
          method_name: "storage_balance_of",
          args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString("base64"),
        },
      }),
      timeoutMs: 10_000,
    });
    if (!res.result) return null;
    return JSON.parse(Buffer.from(res.result.result).toString("utf8")) !== null;
  } catch {
    return null;
  }
}

/** How much of a NEAR token (smallest units) an account holds; null when the chain couldn't be asked. */
export async function tokenBalanceOnNear(assetId: string, accountId: string, rpcUrl = readEnv().NEAR_RPC_URL): Promise<bigint | null> {
  const contract = nep141Contract(assetId);
  if (!contract) return null;
  try {
    const res = await fetchJson(rpcUrl, RpcResult, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "bursar",
        method: "query",
        params: { request_type: "call_function", finality: "final", account_id: contract, method_name: "ft_balance_of", args_base64: Buffer.from(JSON.stringify({ account_id: accountId })).toString("base64") },
      }),
      timeoutMs: 10_000,
    });
    if (!res.result) return null;
    return BigInt(JSON.parse(Buffer.from(res.result.result).toString("utf8")) as string);
  } catch {
    return null;
  }
}

export function notRegisteredText(accountId: string, symbol: string): string {
  return `${accountId} can't receive ${symbol} on NEAR yet: the account has never held ${symbol}. Ask them to add ${symbol} in their NEAR wallet (or receive any amount of it once), then try again. Nothing was sent.`;
}
