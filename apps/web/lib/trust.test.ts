import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTronAddress } from "./demo-addresses";
import { issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { addPayee, setupBusiness } from "./owner-actions";
import { buildPolicy } from "./policy";
import { getBusiness, listPayees } from "./store";
import { createTestDb } from "./test-db";
import { rules, USDT_TRON } from "./test-fixtures";
import { trustSignedPayees } from "./trust";

const t = createTestDb();
afterAll(() => t.close());
const owner = sessionFromCookie(issueSessionCookie("owner.near", "ed25519:x")) as OwnerSession;
const person = (name: string) => ({ name, category: "staff" as const, payout: { token: USDT_TRON, address: demoTronAddress(name), memo: null }, prices: [], recurring: null });

describe("the owner's wallet signature counts as the first-payment OK (live)", () => {
  beforeEach(() => t.reset());

  it("people on the signed list become trusted; people not signed in yet don't", async () => {
    await setupBusiness(t.db, owner, { name: "Shop", rules: rules() });
    await addPayee(t.db, owner, person("kemi"));
    const signed = buildPolicy((await getBusiness(t.db))!.rules, await listPayees(t.db));
    await t.db.agentAccount.create({ data: { backend: "agent-api", agentId: "agent-1", policy: JSON.stringify(signed), policyRevision: 1 } });
    await addPayee(t.db, owner, person("tolu")); // added after the signature

    expect(await trustSignedPayees(t.db)).toEqual(["kemi"]);
    const byName = Object.fromEntries((await listPayees(t.db)).map((p) => [p.name, p.trustedAt]));
    expect(byName.kemi).not.toBeNull();
    expect(byName.tolu).toBeNull();
    expect(await trustSignedPayees(t.db)).toEqual([]); // nothing new the second time
  });

  it("practice mode (no wallet signature) leaves trust to the owner's own OK", async () => {
    await setupBusiness(t.db, owner, { name: "Shop", rules: rules() });
    await addPayee(t.db, owner, person("kemi"));
    expect(await trustSignedPayees(t.db)).toEqual([]);
  });
});
