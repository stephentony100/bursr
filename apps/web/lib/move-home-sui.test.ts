import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PayoutToken } from "./domain";

// "Move money back to my wallet" for an owner who signed in with Sui: the
// money is exchanged into USDC on Sui inside the account, then sent to their
// own Sui address, the one in their sign-in ID.

const USDC_SUI: PayoutToken = { assetId: "nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near", symbol: "USDC", chain: "sui", decimals: 6 };
vi.mock("./tokens", async (orig) => {
  const { USDC_NEAR } = await import("./test-fixtures");
  return { ...(await orig<typeof import("./tokens")>()), payoutTokens: async () => [USDC_NEAR, USDC_SUI] };
});

import { SimulatedAccount } from "./agent-account/simulated";
import { homeFor, ownerHome } from "./home";
import { homeView, moveMoneyHome } from "./move-home";
import { pendingChanges } from "./pending-changes";
import { issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { setupBusiness } from "./owner-actions";
import { buildPolicy } from "./policy";
import { createTestDb } from "./test-db";
import { rules, USDC_NEAR, usd } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());
const M = 1_000_000n;
const address = `0x${"98d4".repeat(16)}`;
const owner = sessionFromCookie(issueSessionCookie(`sui:${address}`, "")) as OwnerSession;
const account = () => new SimulatedAccount(t.db, { [USDC_NEAR.assetId]: 6, [USDC_SUI.assetId]: 6 });

beforeEach(async () => {
  await t.reset();
  const r = rules({ weeklyCapUsd: usd(10), perPaymentCapUsd: usd(2), approvalThresholdUsd: usd(1) });
  await setupBusiness(t.db, owner, { name: "Stak", rules: r });
  // The rules the owner's passkey signed, with their own Sui address on the list.
  const policy = buildPolicy(r, [], homeFor(r, owner.accountId, USDC_SUI));
  await t.db.agentAccount.create({
    data: { backend: "simulated", agentId: "dry-run", policy: JSON.stringify(policy), simBalances: JSON.stringify({ [USDC_NEAR.assetId]: (20n * M).toString() }) },
  });
});

describe("moving money back to a Sui wallet", () => {
  it("home is the owner's own Sui address, in USDC on Sui from the token list", async () => {
    expect(await ownerHome(rules(), owner.accountId)).toEqual({ chain: "sui", address, token: USDC_SUI });
  });

  it("exchanges, then sends to the owner's own Sui address, in parts no bigger than the largest single payment", async () => {
    const r = await moveMoneyHome(t.db, owner, account(), 3n * M);
    expect(r.parts).toBe(2);
    await r.done;
    const actions = await t.db.accountAction.findMany({ orderBy: { at: "asc" } });
    expect(actions.map((a) => a.kind)).toEqual(["swap", "withdraw", "swap", "withdraw"]);
    for (const a of actions.filter((x) => x.kind === "withdraw")) {
      expect(JSON.parse(a.request)).toMatchObject({ asset: USDC_SUI.assetId, chain: "sui", recipient: address });
    }
    const s = await account().status();
    expect(s.balances[USDC_NEAR.assetId]).toBe(17n * M);
    expect(s.balances[USDC_SUI.assetId] ?? 0n).toBe(0n);
    const done = await t.db.auditEvent.findFirst({ where: { kind: "home_done" } });
    expect(done?.message).toContain("Sui · 0x98d4");
  });

  it("counts the weekly limit twice (the exchange, then the send) and says so", async () => {
    const view = (await homeView(t.db, account()))!;
    expect(view.exchanged).toBe(true);
    expect(view.canMoveUsd).toBe(5n * M); // $10 weekly, halved
    expect(view.limitedBy).toMatch(/counts twice/);
  });

  it("the wallet refuses any other Sui address", async () => {
    const out = await account().execute({ kind: "withdraw", asset: USDC_SUI.assetId, amount: M, chain: "sui", recipient: `0x${"ee".repeat(32)}`, memo: null }, "attack");
    expect(out.status === "refused" && out.refusal.code).toBe("policy_destination_denied");
  });

  it("a Sui business signed before this asks the owner to add their own wallet to the list", async () => {
    const r = rules({ weeklyCapUsd: usd(10), perPaymentCapUsd: usd(2), approvalThresholdUsd: usd(1) });
    await t.db.agentAccount.update({ where: { id: "main" }, data: { backend: "agent-api", policy: JSON.stringify(buildPolicy(r, [], null)) } });
    const p = await pendingChanges(t.db);
    expect(p?.lines).toContain("Let you move money back to your own wallet");
    expect(p?.onlyTighter).toBe(false);
  });
});
