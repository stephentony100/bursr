import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTronAddress } from "./demo-addresses";
import { approveInvite, createInvite, declineInvite, listInvites, publicInvite, submitInvite } from "./invites";
import { markOnboarding, onboardingState } from "./onboarding";
import { demoOwner, issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { setupBusiness } from "./owner-actions";
import { listPayees } from "./store";
import { createTestDb } from "./test-db";
import { rules, USDT_TRON } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();
const stranger = sessionFromCookie(issueSessionCookie("stranger.near", "ed25519:x")) as OwnerSession;

beforeEach(() => t.reset());

describe("onboarding steps (practice mode)", () => {
  it("walks business → limits → people → agent → money → done, in order", async () => {
    const step = async () => (await onboardingState(t.db, owner)).current;
    expect(await step()).toBe("business");
    await setupBusiness(t.db, owner, { name: "Mama's Kitchen", rules: rules() });
    expect(await step()).toBe("limits");
    for (const [mark, next] of [
      ["limits", "people"],
      ["people", "agent"],
      ["agent", "money"],
      ["money", "done"],
    ] as const) {
      await markOnboarding(t.db, mark);
      expect(await step()).toBe(next);
    }
    await markOnboarding(t.db, "finished");
    expect((await onboardingState(t.db, owner)).finished).toBe(true);
  });

  it("without a signed-in owner the first step is the wallet", async () => {
    expect((await onboardingState(t.db, null)).current).toBe("wallet");
  });
});

describe("invites: the person fills in how they want to be paid; the owner approves", () => {
  beforeEach(() => setupBusiness(t.db, owner, { name: "Mama's Kitchen", rules: rules() }));

  it("only the owner can invite", async () => {
    await expect(createInvite(t.db, stranger, { name: "Ade", category: "staff", recurring: null })).rejects.toThrow();
  });

  it("they send their details once; nothing is payable until the owner approves", async () => {
    const inv = await createInvite(t.db, owner, { name: "Ade", category: "staff", recurring: { amountUsd: "50000000", every: "week" } });
    expect(await publicInvite(t.db, inv.token)).toMatchObject({ businessName: "Mama's Kitchen", name: "Ade", state: "open" });
    await expect(submitInvite(t.db, inv.token, { assetId: USDT_TRON.assetId, address: "not-an-address", memo: "" })).rejects.toThrow(/valid address/);
    await submitInvite(t.db, inv.token, { assetId: USDT_TRON.assetId, address: demoTronAddress("ade"), memo: "" });
    await expect(submitInvite(t.db, inv.token, { assetId: USDT_TRON.assetId, address: demoTronAddress("someone-else"), memo: "" })).rejects.toThrow(/already used|expired/);
    expect(await listPayees(t.db)).toHaveLength(0);
    expect((await publicInvite(t.db, inv.token))!.state).toBe("sent");

    await expect(approveInvite(t.db, stranger, inv.id)).rejects.toThrow();
    await approveInvite(t.db, owner, inv.id);
    const [ade] = await listPayees(t.db);
    expect(ade).toMatchObject({ name: "Ade", category: "staff", payout: { address: demoTronAddress("ade") }, trustedAt: null, recurring: { every: "week" } });
    expect(await listInvites(t.db)).toHaveLength(0);
  });

  it("an expired or declined link can't be used", async () => {
    const old = await createInvite(t.db, owner, { name: "Bola", category: "supplier", recurring: null }, new Date(Date.now() - 8 * 24 * 60 * 60_000));
    expect((await publicInvite(t.db, old.token))!.state).toBe("closed");
    await expect(submitInvite(t.db, old.token, { assetId: USDT_TRON.assetId, address: demoTronAddress("bola"), memo: "" })).rejects.toThrow(/expired/);
    const inv = await createInvite(t.db, owner, { name: "Chi", category: "staff", recurring: null });
    await declineInvite(t.db, owner, inv.id);
    await expect(submitInvite(t.db, inv.token, { assetId: USDT_TRON.assetId, address: demoTronAddress("chi"), memo: "" })).rejects.toThrow(/expired|used/);
  });
});
