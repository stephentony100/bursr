import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTronAddress } from "./demo-addresses";
import { isOnPayoutHold, payoutHoldEndsAt } from "./domain";
import { SimulatedAccount } from "./agent-account/simulated";
import { addPayee, changePayout, NotOwnerError, removePayee, setFrozen, setupBusiness, updateRules } from "./owner-actions";
import { demoOwner, issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { getAccountRecord, getPayee } from "./store";
import { createTestDb } from "./test-db";
import { rules, USDC_NEAR, USDT_TRON } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());

const M = 1_000_000n;
const owner = demoOwner();
const stranger = sessionFromCookie(issueSessionCookie("stranger.near", "ed25519:x")) as OwnerSession;
const decimals = { [USDC_NEAR.assetId]: 6, [USDT_TRON.assetId]: 6 };
const tronAddr = demoTronAddress("tomato-farm");

async function setup() {
  await setupBusiness(t.db, owner, {
    name: "Bukka Corner",
    rules: rules({ payoutTokens: [USDC_NEAR, USDT_TRON] }),
    demoBalances: { [USDC_NEAR.assetId]: 5_000n * M, [USDT_TRON.assetId]: 1_000n * M },
  });
  return addPayee(t.db, owner, {
    name: "Tomato Farm",
    category: "supplier",
    payout: { token: USDT_TRON, address: tronAddr, memo: null },
    prices: [],
    recurring: null,
  });
}

const pay = (recipient: string, dollars = 10n) =>
  ({ kind: "withdraw", asset: USDT_TRON.assetId, amount: dollars * M, chain: "tron", recipient }) as const;

describe("owner-only actions", () => {
  beforeEach(() => t.reset());

  it("adding a payee puts it on the account's allowlist", async () => {
    await setup();
    const account = new SimulatedAccount(t.db, decimals);
    expect((await account.execute(pay(tronAddr), "k1")).status).toBe("accepted");
  });

  it("someone who is not the owner cannot add payees, change payouts or rules", async () => {
    const id = await setup();
    const input = { name: "Evil", category: "supplier" as const, payout: { token: USDT_TRON, address: demoTronAddress("evil"), memo: null }, prices: [], recurring: null };
    await expect(addPayee(t.db, stranger, input)).rejects.toThrow(NotOwnerError);
    await expect(changePayout(t.db, stranger, id, input.payout)).rejects.toThrow(NotOwnerError);
    await expect(updateRules(t.db, stranger, rules({ weeklyCapUsd: (10n ** 12n).toString() }))).rejects.toThrow(NotOwnerError);
    await expect(setFrozen(t.db, stranger, false)).rejects.toThrow(NotOwnerError);
  });

  it("a forged session object is not accepted", async () => {
    const id = await setup();
    const forged = { accountId: "demo-owner.near", publicKey: null, demo: true } as unknown as OwnerSession;
    await expect(changePayout(t.db, forged, id, { token: USDT_TRON, address: demoTronAddress("evil"), memo: null })).rejects.toThrow(
      NotOwnerError,
    );
  });

  it("a tampered session cookie is not accepted", () => {
    const cookie = issueSessionCookie("stephentony.near", "ed25519:x");
    const [body, sig] = cookie.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ a: "attacker.near", k: "ed25519:x", e: Date.now() + 1e6 })).toString("base64url");
    expect(sessionFromCookie(`${forgedBody}.${sig}`)).toBeNull();
    expect(sessionFromCookie(`${body}.${sig}`)?.accountId).toBe("stephentony.near");
    expect(sessionFromCookie(cookie, Date.now() + 13 * 60 * 60 * 1000)).toBeNull(); // expired
  });

  it("changing a payout address starts a 48-hour hold and is logged with before/after", async () => {
    const id = await setup();
    const now = new Date("2026-11-06T10:00:00Z");
    const newAddr = demoTronAddress("tomato-farm-new");
    await changePayout(t.db, owner, id, { token: USDT_TRON, address: newAddr, memo: null }, now);
    const p = await getPayee(t.db, id);
    expect(p?.payout.address).toBe(newAddr);
    expect(payoutHoldEndsAt(p!)?.toISOString()).toBe("2026-11-08T10:00:00.000Z");
    expect(isOnPayoutHold(p!, new Date("2026-11-08T09:59:59Z"))).toBe(true);
    expect(isOnPayoutHold(p!, new Date("2026-11-08T10:00:00Z"))).toBe(false);
    const log = await t.db.auditEvent.findFirst({ where: { kind: "payout_changed" } });
    expect(JSON.parse(log!.data!).before.address).toBe(tronAddr);
  });

  it("after a payout change the old address is no longer allowed by the account", async () => {
    const id = await setup();
    await changePayout(t.db, owner, id, { token: USDT_TRON, address: demoTronAddress("tomato-farm-new"), memo: null });
    const account = new SimulatedAccount(t.db, decimals);
    const out = await account.execute(pay(tronAddr), "old-address");
    expect(out.status === "refused" && out.refusal.code).toBe("policy_destination_denied");
  });

  it("refuses a payout token the rules do not allow", async () => {
    await setup();
    const usdcBase = { assetId: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near", symbol: "USDC" as const, chain: "base", decimals: 6 };
    await expect(
      addPayee(t.db, owner, { name: "X", category: "staff", payout: { token: usdcBase, address: "0x" + "1".repeat(40), memo: null }, prices: [], recurring: null }),
    ).rejects.toThrow(/not one of the tokens the rules allow/);
  });

  it("removing a payee takes them off the allowlist", async () => {
    const id = await setup();
    // A second Tron payee keeps Tron USDT allowed, so only the allowlist decides.
    await addPayee(t.db, owner, {
      name: "Pepper Farm",
      category: "supplier",
      payout: { token: USDT_TRON, address: demoTronAddress("pepper-farm"), memo: null },
      prices: [],
      recurring: null,
    });
    await removePayee(t.db, owner, id);
    const out = await new SimulatedAccount(t.db, decimals).execute(pay(tronAddr), "after-remove");
    expect(out.status === "refused" && out.refusal.code).toBe("policy_destination_denied");
  });

  it("each owner change bumps the account's policy revision", async () => {
    await setup();
    const before = (await getAccountRecord(t.db))!.policyRevision;
    await setFrozen(t.db, owner, true);
    expect((await getAccountRecord(t.db))!.policyRevision).toBe(before + 1);
  });

  it("rules are validated: per-payment cap cannot exceed the weekly cap", async () => {
    await setup();
    await expect(updateRules(t.db, owner, rules({ weeklyCapUsd: "100", perPaymentCapUsd: "200", approvalThresholdUsd: "50" }))).rejects.toThrow(
      /per-payment cap/,
    );
  });
});
