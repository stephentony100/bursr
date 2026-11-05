import { AgentApiAccount } from "./agent-account/agent-api";
import { SimulatedAccount } from "./agent-account/simulated";
import type { AgentAccount } from "./agent-account/types";
import { db as defaultDb } from "./db";
import { readEnv } from "./env";
import type { PrismaClient } from "./generated/prisma/client";
import { getAccountRecord, getBusiness } from "./store";

// ALL payment code goes through here (AGENTS.md rule 3). Dry-run: the local
// simulator of the Agent API policy. Live: the Agent API on mainnet, acting
// with the agent's grant token only.

export type { AccountStatus, ActionOutcome, ActionRequest, AgentAccount } from "./agent-account/types";

export async function agentAccount(db: PrismaClient = defaultDb()): Promise<AgentAccount> {
  const env = readEnv();
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");

  if (env.BURSAR_MODE === "dry-run") {
    const tokens = [business.rules.treasury, ...business.rules.payoutTokens];
    return new SimulatedAccount(db, Object.fromEntries(tokens.map((t) => [t.assetId, t.decimals])));
  }

  const record = await getAccountRecord(db);
  const agentId = env.AGENT_API_AGENT_ID ?? record?.agentId;
  if (!env.AGENT_API_KEY || !agentId || !env.AGENT_API_GRANT_TOKEN) {
    throw new Error("Live mode needs AGENT_API_KEY, the agent (create it on the Setup page) and AGENT_API_GRANT_TOKEN in .env.");
  }
  return new AgentApiAccount({
    apiKey: env.AGENT_API_KEY,
    baseUrl: env.AGENT_API_BASE_URL,
    agentId,
    grantToken: env.AGENT_API_GRANT_TOKEN,
  });
}
