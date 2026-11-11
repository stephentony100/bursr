import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTronAddress } from "./demo-addresses";
import { approveAllInvites, createInvite, listInvites, publicInvite, submitInvite } from "./invites";
import { demoOwner } from "./owner";
import { addPayees, setupBusiness, MAX_ADDRESSES } from "./owner-actions";
import { buildPolicy } from "./policy";
import { getBusiness, listPayees } from "./store";
import { createTestDb } from "./test-db";
import { rules, USDC_NEAR, USDT_TRON } from "./test-fixtures";

// Many people at once: a spreadsheet's rows, or a group link everyone answers.

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();

beforeEach(async () => {
  await t.reset();
  await setupBusiness(t.db, owner, { name: "Bukka Corner", rules: rules({ payoutTokens: [USDC_NEAR, USDT_TRON] }), demoBalances: {} });
});

const person = (i: number) => ({ name: `Worker ${i}`, category: "staff" as const, payout: { token: USDT_TRON, address: demoTronAddress(`w${i}`), memo: null }, prices: [], recurring: null });

describe("adding many people", () => {
  it("adds everyone in one go, and the wallet's list grows to fit (with room in the hourly action limit)", async () => {
    await addPayees(t.db, owner, Array.from({ length: 40 }, (_, i) => person(i)));
    const payees = await listPayees(t.db);
    expect(payees).toHaveLength(40);
    const policy = buildPolicy((await getBusiness(t.db))!.rules, payees);
    expect(policy.destinations.list.length).toBe(40);
    expect(policy.max_actions_per_hour).toBeGreaterThanOrEqual(80);
  });

  it(`refuses more than ${MAX_ADDRESSES} different addresses, and adds nobody`, async () => {
    await expect(addPayees(t.db, owner, Array.from({ length: MAX_ADDRESSES + 1 }, (_, i) => person(i)))).rejects.toThrow(/up to 256/);
    expect(await listPayees(t.db)).toHaveLength(0);
  });

  it("one bad row stops the whole list (nothing half-added)", async () => {
    const bad = { ...person(2), payout: { ...person(2).payout, address: "nope" } };
    await expect(addPayees(t.db, owner, [person(1), bad])).rejects.toThrow();
    expect(await listPayees(t.db)).toHaveLength(0);
  });

  it("a group link: each person sends their own details, the link stays open, and Approve all adds them", async () => {
    const link = await createInvite(t.db, owner, { name: "Kitchen staff", category: "staff", recurring: { amountUsd: "50000000", every: "week" }, group: true });
    expect((await publicInvite(t.db, link.token))?.group).toBe(true);
    for (const n of ["Ada", "Bayo", "Chi"]) {
      await submitInvite(t.db, link.token, { assetId: USDT_TRON.assetId, address: demoTronAddress(n), memo: "", name: n });
    }
    await expect(submitInvite(t.db, link.token, { assetId: USDT_TRON.assetId, address: demoTronAddress("x"), memo: "" })).rejects.toThrow(/your name/);
    expect((await publicInvite(t.db, link.token))?.state).toBe("open");
    expect((await listInvites(t.db)).filter((i) => i.status === "submitted")).toHaveLength(3);

    const { approved, problems } = await approveAllInvites(t.db, owner);
    expect(approved).toBe(3);
    expect(problems).toEqual([]);
    const names = (await listPayees(t.db)).map((p) => p.name).sort();
    expect(names).toEqual(["Ada", "Bayo", "Chi"]);
    expect((await listPayees(t.db))[0].recurring).toMatchObject({ amountUsd: "50000000", every: "week" });
  });
});
