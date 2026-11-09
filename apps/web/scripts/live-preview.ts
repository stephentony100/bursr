// npm run live:preview: for each payment in the current draft plan, asks the
// LIVE agent account for a dry preview (dry: true moves nothing): the swap it
// would need, the withdrawal fee, what the payee would receive, and any rule
// the account would refuse. Run this before approving a live plan.
import "./load-env";
import { createAgentApi } from "@near-intents-agent-api/sdk";
import { db } from "../lib/db";
import { readEnv } from "../lib/env";
import { formatUnits, formatUsd } from "../lib/money";
import { getLatestPlan } from "../lib/plans";
import { amountOutFor } from "../lib/quotes";
import { getBusiness } from "../lib/store";
import { liveAgentConfig } from "../lib/agent-account";

const env = readEnv();
if (env.BURSAR_MODE !== "live") throw new Error("Set BURSAR_MODE=live (and DATABASE_URL to the live database) first.");
const { apiKey, baseUrl, agentId, grantToken } = await liveAgentConfig(db());
const api = createAgentApi({ apiKey, baseUrl });
const agent = api.forGrant(grantToken);
const business = (await getBusiness(db()))!;
const treasury = business.rules.treasury;
const plan = await getLatestPlan(db());
if (!plan || plan.status !== "draft") throw new Error("Prepare a plan on the Plan page first (it must not be approved yet).");

const balances = await api.getBalances(agentId);
console.log(`Agent ${agentId}`);
console.log(`Balances: ${balances.balances.map((b) => `${b.asset_id} ${b.available_raw}`).join(", ") || "none"}`);

let total = 0n;
for (const i of plan.items.filter((x) => x.placement === "in" && x.payout)) {
  const token = i.payout!.token;
  const out = amountOutFor(i.amountUsd, token);
  total += i.amountUsd;
  console.log(`\n${i.payeeName}: ${i.forWhat}, ${formatUsd(i.amountUsd)} as ${token.symbol} on ${token.chain} to ${i.payout!.address}`);
  if (token.assetId !== treasury.assetId) {
    const swap = await agent.swap(agentId, { origin_asset: treasury.assetId, destination_asset: token.assetId, amount: out.toString(), confidential: true, dry: true });
    console.log(`  swap preview: ${JSON.stringify({ amount_out: swap.quote?.amount_out ?? null, fee: swap.fee ?? null, warnings: swap.warnings ?? [] })}`);
  }
  const w = await agent.withdraw(agentId, { asset: token.assetId, amount: out.toString(), chain: token.chain, recipient: i.payout!.address, ...(i.payout!.memo ? { memo: i.payout!.memo } : {}), confidential: true, dry: true });
  console.log(`  withdraw preview: ${JSON.stringify({ amount_out: w.quote?.amount_out ?? null, fee: w.fee ?? null, warnings: w.warnings ?? [] })}`);
}
console.log(`\nPlan total ${formatUsd(total)} (${formatUnits(total, 6)} in USD terms). Nothing was moved.`);
await db().$disconnect();
