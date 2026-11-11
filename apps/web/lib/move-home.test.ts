import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { agentAccount } from "./agent-account";
import { loadSampleBusiness } from "./demo-loader";
import { homeView, moveMoneyHome } from "./move-home";
import { demoOwner, issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { NotOwnerError } from "./owner-actions";
import { getBusiness } from "./store";
import { createTestDb } from "./test-db";

// "Move money back to my wallet" (practice mode): only to the owner, in parts, inside the limits.

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();
const stranger = sessionFromCookie(issueSessionCookie("stranger.near", "ed25519:x")) as OwnerSession;
const M = 1_000_000n;

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

describe("moving money back to the owner's wallet", () => {
  it("moves the amount to the owner's own account, in parts no bigger than the largest single payment", async () => {
    const account = await agentAccount(t.db);
    const before = (await homeView(t.db, account))!;
    expect(before.accountId).toBe(owner.accountId);
    const r = await moveMoneyHome(t.db, owner, account, 1_000n * M); // above the $900 per-payment cap
    expect(r.parts).toBe(2);
    await r.done;
    const after = (await homeView(t.db, account))!;
    expect(before.balanceUsd - after.balanceUsd).toBe(1_000n * M);
    const log = await t.db.auditEvent.findFirst({ where: { kind: "home_done" } });
    expect(log?.message).toContain("Moved $1,000.00 back to your wallet");
  });

  it("refuses more than the weekly limit allows, and says why", async () => {
    const account = await agentAccount(t.db);
    const view = (await homeView(t.db, account))!;
    const weekly = BigInt((await getBusiness(t.db))!.rules.weeklyCapUsd);
    expect(view.canMoveUsd).toBeLessThanOrEqual(weekly);
    await expect(moveMoneyHome(t.db, owner, account, view.canMoveUsd + M)).rejects.toThrow(/You can move up to|Your Bursar wallet has/);
  });

  it("only the owner can move money", async () => {
    await expect(moveMoneyHome(t.db, stranger, await agentAccount(t.db), M)).rejects.toThrow(NotOwnerError);
  });

  it("the wallet still refuses any other address: the owner's account is the only extra entry on the list", async () => {
    const account = await agentAccount(t.db);
    const s = await account.status();
    const treasury = (await getBusiness(t.db))!.rules.treasury;
    const out = await account.execute({ kind: "withdraw", asset: treasury.assetId, amount: M, chain: "near", recipient: "attacker.near", memo: null }, "attack");
    expect(out.status === "refused" && out.refusal.code).toBe("policy_destination_denied");
    expect((s.policy.destinations.list as { address: string }[]).some((d) => d.address === owner.accountId)).toBe(true);
  });
});
