import { createAgentApi, createIdempotencyKey } from "@near-intents-agent-api/sdk";
import { PRIVATE_PAYMENTS } from "./agent-account/agent-api";
import type { PrismaClient } from "./generated/prisma/client";
import { readEnv } from "./env";
import { formatUnits, parseUnits } from "./money";
import { tokenBalanceOnNear } from "./near-storage";
import { getAccountRecord, getBusiness } from "./store";
import { CHAIN_NAMES } from "./tokens";

// Adding money to the agent's wallet without copying anything by hand:
// - one tap from the owner's connected NEAR wallet: an `ft_transfer_call` of
//   USDC to `intents.near` naming the agent's NEAR Intents account (NEAR
//   Intents docs, "Deposits": the `msg` "specifying who will own the tokens";
//   Agent API funding: "send a transfer to agent.wallet.near_account_id");
// - from any other chain: a one-time deposit address (Agent API `deposit`),
//   shown with a QR code; the agent watches and says when it arrives;
// - practice mode: practice money, one tap.
// The agent never pulls money from the owner's wallet.

export const INTENTS_CONTRACT = "intents.near";

function api() {
  const env = readEnv();
  if (!env.AGENT_API_KEY) throw new Error("Live mode needs AGENT_API_KEY in .env.");
  return createAgentApi({ apiKey: env.AGENT_API_KEY, baseUrl: env.AGENT_API_BASE_URL });
}

async function agentId(db: PrismaClient): Promise<string> {
  const record = await getAccountRecord(db);
  if (!record || record.backend !== "agent-api") throw new Error("Set up your Bursr wallet first (Limits page).");
  return record.agentId;
}

export interface OneTapDeposit {
  /** The token contract the owner's wallet calls (USDC on NEAR). */
  tokenContract: string;
  symbol: string;
  decimals: number;
  /** The agent's NEAR Intents account: the `msg` of the transfer. */
  agentAccount: string;
  /** What the owner's own wallet holds of that token (smallest units); null if it couldn't be checked. */
  ownerBalance: string | null;
}

/** What the owner's wallet signs for a one-tap top-up (live mode). */
export async function oneTapDeposit(db: PrismaClient, ownerAccountId: string): Promise<OneTapDeposit> {
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");
  const t = business.rules.treasury;
  if (t.chain !== "near" || !t.assetId.startsWith("nep141:")) throw new Error("One-tap top-up needs the Bursr wallet to hold a NEAR token.");
  // The same account the balances belong to (seen live: getBalances → near_account_id).
  const { near_account_id } = await api().getBalances(await agentId(db), { source: "public" });
  const held = await tokenBalanceOnNear(t.assetId, ownerAccountId);
  return { tokenContract: t.assetId.slice("nep141:".length), symbol: t.symbol, decimals: t.decimals, agentAccount: near_account_id, ownerBalance: held === null ? null : held.toString() };
}

export interface DepositAddress {
  symbol: string;
  chain: string;
  chainName: string;
  address: string;
  memo: string | null;
  minimum: string | null;
  openUntil: string | null;
}

/** A one-time address on another chain; whatever arrives is converted to the Bursr wallet's currency. */
export async function depositAddress(db: PrismaClient, symbol: string, chain: string): Promise<DepositAddress> {
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");
  const client = api();
  const tokens = (await client.getTokens()).filter((t) => t.symbol === symbol && t.blockchain === chain);
  if (tokens.length !== 1) throw new Error(`Bursr can't take ${symbol} on ${CHAIN_NAMES[chain] ?? chain} yet.`);
  const origin = tokens[0];
  const treasury = business.rules.treasury.assetId;
  const d = await client.deposit(
    await agentId(db),
    { origin_asset: origin.asset_id, ...(origin.asset_id !== treasury ? { destination_asset: treasury } : {}), confidential: PRIVATE_PAYMENTS },
    { idempotencyKey: createIdempotencyKey() },
  );
  const det = d.details as { deposit_address?: string | null; memo?: string | null; min_amount?: string | null; expires_at?: string | null };
  if (!det.deposit_address) throw new Error("The deposit service didn't give an address. Please try again in a minute.");
  return {
    symbol,
    chain,
    chainName: CHAIN_NAMES[chain] ?? chain,
    address: det.deposit_address,
    memo: det.memo ?? null,
    minimum: det.min_amount ? formatUnits(BigInt(det.min_amount), origin.decimals) : null,
    openUntil: det.expires_at ?? null,
  };
}

/** Practice mode: adds practice money to the simulated wallet. */
export async function addPracticeMoney(db: PrismaClient, dollars: string) {
  const business = await getBusiness(db);
  const row = await db.agentAccount.findUnique({ where: { id: "main" } });
  if (!business || !row) throw new Error("Open the sample restaurant first.");
  const t = business.rules.treasury;
  const balances = JSON.parse(row.simBalances) as Record<string, string>;
  balances[t.assetId] = (BigInt(balances[t.assetId] ?? "0") + parseUnits(dollars, t.decimals)).toString();
  await db.agentAccount.update({ where: { id: "main" }, data: { simBalances: JSON.stringify(balances) } });
}
