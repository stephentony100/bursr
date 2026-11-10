// npm run fund -- <SYMBOL> <chain>   e.g.  npm run fund -- USDC base
// Creates a deposit address for the LIVE agent account. Funds sent there in
// that token on that chain are converted to the account's treasury token
// (USDC on NEAR) and credited to the balance payments spend from (public while
// PRIVATE_PAYMENTS is off). Creating the
// address spends nothing; only send money after the owner has agreed to it.
import "./load-env";
import { createAgentApi, createIdempotencyKey } from "@near-intents-agent-api/sdk";
import { PRIVATE_PAYMENTS } from "../lib/agent-account/agent-api";
import { db } from "../lib/db";
import { scriptDb } from "../lib/tenant";
import { readEnv } from "../lib/env";
import { formatUnits } from "../lib/money";
import { getAccountRecord, getBusiness } from "../lib/store";

const [symbol = "USDC", chain = "near"] = process.argv.slice(2);
const env = readEnv();
const sdb = await scriptDb(db());
if (env.BURSAR_MODE !== "live") throw new Error("Set BURSAR_MODE=live first.");
const agentId = env.AGENT_API_AGENT_ID ?? (await getAccountRecord(sdb))?.agentId;
if (!env.AGENT_API_KEY || !agentId) throw new Error("Needs AGENT_API_KEY and the agent.");
const api = createAgentApi({ apiKey: env.AGENT_API_KEY, baseUrl: env.AGENT_API_BASE_URL });
const treasury = (await getBusiness(sdb))!.rules.treasury;
const tokens = (await api.getTokens()).filter((t) => t.symbol === symbol && t.blockchain === chain);
if (tokens.length !== 1) throw new Error(`Expected one ${symbol} on ${chain} in the Agent API token list, found ${tokens.length}.`);
const origin = tokens[0];
const d = await api.deposit(
  agentId,
  { origin_asset: origin.asset_id, ...(origin.asset_id !== treasury.assetId ? { destination_asset: treasury.assetId } : {}), confidential: PRIVATE_PAYMENTS },
  { idempotencyKey: createIdempotencyKey() },
);
const det = d.details as { deposit_address?: string | null; memo?: string | null; min_amount?: string | null; expires_at?: string | null };
console.log(`Deposit for agent ${agentId}: send ${symbol} on ${chain} to`);
console.log(`  address   ${det.deposit_address ?? "(none: do not send anything)"}`);
if (det.memo) console.log(`  memo      ${det.memo}  (include it, or the funds are lost)`);
console.log(`  minimum   ${det.min_amount ? formatUnits(BigInt(det.min_amount), origin.decimals) : "?"} ${symbol}`);
console.log(`  open until ${det.expires_at ?? "?"}`);
console.log(`  tracking  ${d.correlation_id}`);
await sdb.$disconnect();
