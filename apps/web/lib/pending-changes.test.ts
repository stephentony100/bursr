import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTronAddress } from "./demo-addresses";
import { issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { addPayee, removePayee, setupBusiness, updateRules } from "./owner-actions";
import { pendingChanges } from "./pending-changes";
import { buildPolicy } from "./policy";
import { getBusiness, listPayees } from "./store";
import { createTestDb } from "./test-db";
import { rules, USDT_TRON } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());
const owner = sessionFromCookie(issueSessionCookie("owner.near", "ed25519:x")) as OwnerSession;

/** A live business whose wallet has signed the current rules and people. */
async function signedBusiness() {
  await setupBusiness(t.db, owner, { name: "Shop", rules: rules() });
  const id = await addPayee(t.db, owner, { name: "Kemi", category: "staff", payout: { token: USDT_TRON, address: demoTronAddress("kemi"), memo: null }, prices: [], recurring: null });
  const policy = buildPolicy((await getBusiness(t.db))!.rules, await listPayees(t.db), owner.accountId);
  await t.db.agentAccount.create({ data: { backend: "agent-api", agentId: "agent-1", policy: JSON.stringify(policy), policyRevision: 1 } });
  return id;
}

describe("changes waiting for the owner's wallet", () => {
  beforeEach(() => t.reset());

  it("nothing to confirm when Bursar and the wallet agree", async () => {
    await signedBusiness();
    expect(await pendingChanges(t.db)).toBeNull();
  });

  it("a removal is listed by name and counts as tighter (Bursar already follows it)", async () => {
    const kemi = await signedBusiness();
    await removePayee(t.db, owner, kemi);
    expect(await pendingChanges(t.db)).toEqual({ lines: ["Remove Kemi"], onlyTighter: true });
  });

  it("a wallet signed before money could move back lists the owner's own wallet in plain words", async () => {
    await setupBusiness(t.db, owner, { name: "Shop", rules: rules() });
    const policy = buildPolicy((await getBusiness(t.db))!.rules, await listPayees(t.db));
    await t.db.agentAccount.create({ data: { backend: "agent-api", agentId: "agent-1", policy: JSON.stringify(policy), policyRevision: 1 } });
    expect((await pendingChanges(t.db))!.lines).toEqual(["Let you move money back to your own wallet"]);
  });

  it("a new person and a higher limit wait for the wallet", async () => {
    await signedBusiness();
    await addPayee(t.db, owner, { name: "Tolu", category: "staff", payout: { token: USDT_TRON, address: demoTronAddress("tolu"), memo: null }, prices: [], recurring: null });
    await updateRules(t.db, owner, { ...rules(), weeklyCapUsd: "2000000000" });
    const p = (await pendingChanges(t.db))!;
    expect(p.onlyTighter).toBe(false);
    expect(p.lines).toEqual(["Add Tolu (paid on Tron)", "Weekly limit $1,000.00 → $2,000.00"]);
  });
});
