// npm run rules:live: proves the owner's rules are enforced by the agent
// account itself (the NEAR Intents Agent API on mainnet), not by Bursr.
// It asks the live account for payments the rules forbid and records what the
// account answers. Use an UNFUNDED agent: even if a rule were missing, there is
// nothing to move. Needs AGENT_API_KEY and BURSAR_DATA_KEY in .env, and the
// agent and its payment pass (set up on Spending rules in live mode).
import "./load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AgentApiError, createAgentApi, createIdempotencyKey, type Policy } from "@near-intents-agent-api/sdk";
import { db } from "../lib/db";
import { scriptDb } from "../lib/tenant";
import { demoEvmAddress, demoNearImplicit, demoSolanaAddress, demoTronAddress } from "../lib/demo-addresses";
import { liveAgentConfig } from "../lib/agent-account";
import { BALANCE_SOURCE } from "../lib/agent-account/agent-api";

type Step = { name: string; expect: string; got: string; pass: boolean; detail: unknown };

async function main() {
  const { apiKey, baseUrl, agentId, grantToken } = await liveAgentConfig(await scriptDb(db()));
  const api = createAgentApi({ apiKey, baseUrl });
  const agent = api.forGrant(grantToken);

  const view = await api.getPolicy(agentId);
  const policy = view.policy as Policy | null;
  if (!policy) throw new Error("The agent has no applied policy.");
  const balances = await api.getBalances(agentId, { source: BALANCE_SOURCE });
  console.log(`Agent ${agentId}, policy revision ${view.revision}, frozen=${policy.frozen}`);
  console.log(`Balances: ${JSON.stringify(balances.balances.map((b) => [b.asset_id, b.available_raw]))}`);

  const steps: Step[] = [];
  const record = (s: Step) => {
    steps.push(s);
    console.log(`${s.pass ? "PASS" : "FAIL"}  ${s.name}\n      expected ${s.expect}, got ${s.got}`);
  };

  // A token the policy allows, so only the rule under test can refuse.
  const allowed = policy.assets === "any" ? null : policy.assets;
  const tokens = await api.getTokens();
  const usable = tokens.filter((t) => (!allowed || allowed.includes(t.asset_id)) && ["near", "tron", "base", "sol"].includes(t.blockchain));
  const pick = usable.find((t) => t.symbol === "USDC" || t.symbol === "USDT");
  if (!pick) throw new Error("The policy allows no USDC/USDT on NEAR, Tron, Base or Solana.");
  const strangers: Record<string, string> = {
    near: demoNearImplicit("rules-live-stranger"),
    tron: demoTronAddress("rules-live-stranger"),
    base: demoEvmAddress("rules-live-stranger"),
    sol: demoSolanaAddress("rules-live-stranger"),
  };
  const target = { asset: pick.asset_id, chain: pick.blockchain, recipient: strangers[pick.blockchain] };
  const oneDollar = (10n ** BigInt(pick.decimals)).toString();

  // 1. Dry preview to an address not on the owner's list.
  const preview = await agent.withdraw(agentId, { ...target, amount: oneDollar, dry: true });
  const codes = (preview.warnings ?? []).map((w) => w.code);
  record({
    name: "Preview: pay $1 to an address that is not on the owner's list",
    expect: "warning policy_destination_denied",
    got: codes.join(", ") || "no warnings",
    pass: codes.includes("policy_destination_denied"),
    detail: preview,
  });

  // 2. A real request to that address. The account must refuse it.
  try {
    const r = await agent.withdraw(agentId, { ...target, amount: oneDollar }, { idempotencyKey: createIdempotencyKey() });
    record({ name: "Live request: pay $1 to an unlisted address", expect: "refusal", got: `ACCEPTED ${r.correlation_id}`, pass: false, detail: r });
  } catch (e) {
    if (!(e instanceof AgentApiError)) throw e;
    record({
      name: "Live request: pay $1 to an unlisted address",
      expect: "403 policy_destination_denied",
      got: `${e.status} ${e.code} (layer ${e.layer})`,
      pass: e.code === "policy_destination_denied",
      detail: { status: e.status, code: e.code, layer: e.layer, title: e.title, detail: e.detail, requestId: e.requestId },
    });
  }

  // 3. Above the per-payment cap, to a listed payee if there is one.
  const listed = policy.destinations.list.find((d): d is { action: "withdraw"; chain: string; address: string; memo: string | null } => "chain" in d);
  const listedAsset = listed && tokens.find((t) => t.blockchain === listed.chain && (!allowed || allowed.includes(t.asset_id)) && policy.limits.per_transaction?.[t.asset_id]);
  if (listed && listedAsset) {
    const cap = BigInt(policy.limits.per_transaction![listedAsset.asset_id]);
    const over = await agent.withdraw(agentId, {
      asset: listedAsset.asset_id,
      amount: (cap + 1n).toString(),
      chain: listed.chain,
      recipient: listed.address,
      ...(listed.memo ? { memo: listed.memo } : {}),
      dry: true,
    });
    const c = (over.warnings ?? []).map((w) => w.code);
    record({
      name: `Preview: pay a listed payee one unit above the per-payment cap`,
      expect: "warning policy_transaction_limit_exceeded",
      got: c.join(", ") || "no warnings",
      pass: c.includes("policy_transaction_limit_exceeded"),
      detail: over,
    });
  } else {
    console.log("SKIP  per-payment cap check: add a payee to the rules and sign them first.");
  }

  const out = path.resolve(process.cwd(), "../../fixtures/live");
  mkdirSync(out, { recursive: true });
  const file = path.join(out, `rules-live-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), agentId, policyRevision: view.revision, policy, steps }, null, 2));
  console.log(`\nSaved ${path.relative(process.cwd(), file)}. Nothing was moved: refused requests create no operation.`);
  if (steps.some((s) => !s.pass)) process.exit(1);
}

main()
  .then(() => db().$disconnect())
  .catch((e) => {
    console.error("FAILED:", e instanceof AgentApiError ? `${e.status} ${e.code}: ${e.detail ?? e.title}` : e instanceof Error ? e.message : e);
    process.exit(1);
  });
