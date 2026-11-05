// Smoke test for the NEAR Intents Agent API. Read-only: it never creates an
// agent, changes a policy or moves funds.
//   no key            → GET /v1/network (public): which network, which contract
//   AGENT_API_KEY     → whoami, partner quota, token count
//   + AGENT_API_AGENT_ID + AGENT_API_GRANT_TOKEN
//                     → the agent's policy, and a dry withdrawal preview to an
//                       address that is NOT on the owner's list. The account's
//                       rules answer with a policy_destination_denied warning.
import "./load-env";
import { z } from "zod";
import { createAgentApi } from "@near-intents-agent-api/sdk";
import { demoEvmAddress } from "../lib/demo-addresses";
import { readEnv } from "../lib/env";
import { fetchJson } from "../lib/http";

async function main() {
  const env = readEnv();
  const base = env.AGENT_API_BASE_URL.replace(/\/$/, "");

  const network = await fetchJson(`${base}/v1/network`, z.looseObject({ network: z.string(), contract_id: z.string().optional() }));
  console.log(`GET ${base}/v1/network → network=${network.network} contract=${network.contract_id ?? "?"}`);

  if (!env.AGENT_API_KEY) {
    console.log("\nSKIPPED authenticated checks: set AGENT_API_KEY (naa_…) in .env. Dry-run never needs it.");
    return;
  }
  const api = createAgentApi({ apiKey: env.AGENT_API_KEY, baseUrl: base });
  const me = await api.whoami();
  const quota = await api.getPartnerQuota();
  const tokens = await api.getTokens();
  console.log("whoami:", JSON.stringify(me));
  console.log("quota:", JSON.stringify(quota));
  console.log(`tokens: ${tokens.length}`);

  if (!env.AGENT_API_AGENT_ID || !env.AGENT_API_GRANT_TOKEN) {
    console.log("\nSKIPPED policy checks: set AGENT_API_AGENT_ID and AGENT_API_GRANT_TOKEN in .env.");
    return;
  }
  const agentId = env.AGENT_API_AGENT_ID;
  const policy = await api.getPolicy(agentId);
  console.log("policy:", JSON.stringify(policy, null, 2));

  const usdcBase = tokens.filter((t) => t.symbol === "USDC" && t.blockchain === "base");
  if (usdcBase.length !== 1) throw new Error(`expected one USDC on base in Agent API tokens, found ${usdcBase.length}`);
  const agent = api.forGrant(env.AGENT_API_GRANT_TOKEN);
  const preview = await agent.withdraw(agentId, {
    asset: usdcBase[0].asset_id,
    amount: "1000000", // 1 USDC, preview only
    chain: "base",
    recipient: demoEvmAddress("not-on-the-owner-list"),
    dry: true,
  });
  console.log("dry withdraw to an unlisted address →", JSON.stringify(preview, null, 2));
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? `${e.name}: ${e.message}` : e);
  process.exit(1);
});
