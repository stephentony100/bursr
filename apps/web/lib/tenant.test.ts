import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createInvite, publicInvite, submitInvite } from "./invites";
import { markOnboarding, onboardingState } from "./onboarding";
import { issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { addPayee, setupBusiness, updateRules } from "./owner-actions";
import { demoTronAddress } from "./demo-addresses";
import { getBusiness, listPayees, recentAudit } from "./store";
import { allBusinessIds, businessIdFor, dbForOwner, scoped } from "./tenant";
import { createTestDb } from "./test-db";
import { rules, USDT_TRON } from "./test-fixtures";

// Many businesses on one Bursr: each wallet sees and changes only its own.

const t = createTestDb();
afterAll(() => t.close());
const session = (a: string) => sessionFromCookie(issueSessionCookie(a, "ed25519:x")) as OwnerSession;
const ada = session("ada.near");
const bayo = session("bayo.near");

beforeEach(() => t.reset());

async function twoBusinesses() {
  const a = await dbForOwner(t.db, "ada.near");
  const b = await dbForOwner(t.db, "bayo.near");
  await setupBusiness(a, ada, { name: "Ada's Bakery", rules: rules() });
  await setupBusiness(b, bayo, { name: "Bayo Tailors", rules: rules() });
  await addPayee(a, ada, { name: "Kemi", category: "staff", payout: { token: USDT_TRON, address: demoTronAddress("kemi"), memo: null }, prices: [], recurring: null });
  await addPayee(b, bayo, { name: "Tolu", category: "staff", payout: { token: USDT_TRON, address: demoTronAddress("tolu"), memo: null }, prices: [], recurring: null });
  return { a, b };
}

describe("one Bursr, many businesses", () => {
  it("each wallet gets its own business, and a new wallet starts empty", async () => {
    const { a, b } = await twoBusinesses();
    expect((await getBusiness(a))!.name).toBe("Ada's Bakery");
    expect((await getBusiness(b))!.name).toBe("Bayo Tailors");
    expect(await getBusiness(await dbForOwner(t.db, "new.near"))).toBeNull();
    expect((await allBusinessIds(t.db)).sort()).toEqual([businessIdFor("ada.near"), businessIdFor("bayo.near")].sort());
    // The same wallet finds the same business again (any device: it's the account that counts).
    expect((await getBusiness(await dbForOwner(t.db, "ada.near")))!.name).toBe("Ada's Bakery");
  });

  it("people, rules, the activity log and setup progress never cross over", async () => {
    const { a, b } = await twoBusinesses();
    expect((await listPayees(a)).map((p) => p.name)).toEqual(["Kemi"]);
    expect((await listPayees(b)).map((p) => p.name)).toEqual(["Tolu"]);
    await updateRules(a, ada, { ...rules(), weeklyCapUsd: "1234000000" });
    expect((await getBusiness(b))!.rules.weeklyCapUsd).not.toBe("1234000000");
    expect((await recentAudit(b)).some((e) => e.message.includes("Kemi"))).toBe(false);
    await markOnboarding(a, "limits");
    expect((await onboardingState(a, ada)).done.limits).toBe(true);
    expect((await onboardingState(b, bayo)).done.limits).toBe(false);
  });

  it("one owner can't change another's business, even holding its own session", async () => {
    const { b } = await twoBusinesses();
    await expect(updateRules(b, ada, rules())).rejects.toThrow();
  });

  it("an invite link finds its own business without anyone signed in", async () => {
    const { a } = await twoBusinesses();
    const inv = await createInvite(a, ada, { name: "Femi", category: "staff", recurring: null });
    expect((await publicInvite(t.db, inv.token))!.businessName).toBe("Ada's Bakery");
    await submitInvite(t.db, inv.token, { assetId: USDT_TRON.assetId, address: demoTronAddress("femi"), memo: "" });
    expect((await scoped(t.db, businessIdFor("bayo.near")).payeeInvite.count())).toBe(0);
    expect((await a.payeeInvite.findFirst())!.status).toBe("submitted");
  });
});
