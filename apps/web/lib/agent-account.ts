import { AgentApiAccount } from "./agent-account/agent-api";
import { SimulatedAccount } from "./agent-account/simulated";
import type { AgentAccount } from "./agent-account/types";
import { readEnv } from "./env";
import { readGrant } from "./grant-store";
import type { PrismaClient } from "./generated/prisma/client";
import { getAccountRecord, getBusiness } from "./store";

// ALL payment code goes through here (AGENTS.md rule 3). Dry-run: the local
// simulator of the Agent API policy. Live: the Agent API on mainnet, acting
// with the agent's grant token only.

export type { AccountStatus, ActionOutcome, ActionRequest, AgentAccount } from "./agent-account/types";

export async function agentAccount(db: PrismaClient): Promise<AgentAccount> {
  const env = readEnv();
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");

  if (env.BURSAR_MODE === "dry-run") {
    const tokens = [business.rules.treasury, ...business.rules.payoutTokens];
    return new SimulatedAccount(db, Object.fromEntries(tokens.map((t) => [t.assetId, t.decimals])));
  }

  return new AgentApiAccount(await liveAgentConfig(db));
}

/** What the live account needs: the partner key from .env, the agent and its sealed pass from the database. */
export async function liveAgentConfig(db: PrismaClient) {
  const env = readEnv();
  if (!env.AGENT_API_KEY) throw new Error("Live mode needs AGENT_API_KEY in .env.");
  const record = await getAccountRecord(db);
  if (!record || record.backend !== "agent-api") throw new Error("Set up your Bursr wallet first (Spending rules).");
  if (env.AGENT_API_AGENT_ID && env.AGENT_API_AGENT_ID !== record.agentId) {
    throw new Error("AGENT_API_AGENT_ID in .env names a different agent than this business's wallet. Remove it from .env.");
  }
  return { apiKey: env.AGENT_API_KEY, baseUrl: env.AGENT_API_BASE_URL, agentId: record.agentId, grantToken: readGrant(record) };
}
