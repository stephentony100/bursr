import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { demoTronAddress } from "../demo-addresses";
import { addPayee, setFrozen, setupBusiness } from "../owner-actions";
import { demoOwner } from "../owner";
import { createTestDb } from "../test-db";
import { rules, USDC_NEAR, USDT_TRON } from "../test-fixtures";
import { SimulatedAccount } from "./simulated";

// The account itself refuses payments outside the owner's rules: above the
// per-payment cap, to a payee not on the list, past the weekly cap, or while
// frozen. These go through the same AgentAccount interface the app uses.

const t = createTestDb();
afterAll(() => t.close());

const M = 1_000_000n;
const owner = demoOwner();
const addr = demoTronAddress("staff-1");
const decimals = { [USDC_NEAR.assetId]: 6, [USDT_TRON.assetId]: 6 };
const pay = (dollars: bigint, recipient = addr) =>
  ({ kind: "withdraw", asset: USDT_TRON.assetId, amount: dollars * M, chain: "tron", recipient }) as const;

async function account(now = () => new Date()) {
  await setupBusiness(t.db, owner, {
    name: "Test",
    rules: rules({ weeklyCapUsd: (1000n * M).toString(), perPaymentCapUsd: (400n * M).toString(), payoutTokens: [USDC_NEAR, USDT_TRON] }),
    demoBalances: { [USDT_TRON.assetId]: 3_000n * M },
  });
  await addPayee(t.db, owner, { name: "Staff", category: "staff", payout: { token: USDT_TRON, address: addr, memo: null }, prices: [], recurring: null });
  return new SimulatedAccount(t.db, decimals, now);
}

describe("simulated agent account", () => {
  beforeEach(() => t.reset());

  it("pays a listed payee and lowers the balance", async () => {
    const a = await account();
    expect((await a.execute(pay(100n), "p1")).status).toBe("accepted");
    expect((await a.status()).balances[USDT_TRON.assetId]).toBe(2_900n * M);
  });

  it("the same idempotency key never pays twice", async () => {
    const a = await account();
    const first = await a.execute(pay(100n), "same-key");
    const second = await a.execute(pay(100n), "same-key");
    expect(second).toEqual(first);
    expect((await a.status()).balances[USDT_TRON.assetId]).toBe(2_900n * M);
    expect(await t.db.accountAction.count()).toBe(1);
  });

  it("refuses above the per-payment cap and logs it as a security event", async () => {
    const a = await account();
    const out = await a.execute(pay(401n), "big");
    expect(out.status === "refused" && out.refusal.code).toBe("policy_transaction_limit_exceeded");
    expect(await t.db.auditEvent.count({ where: { kind: "account_refused" } })).toBe(1);
    expect((await a.status()).balances[USDT_TRON.assetId]).toBe(3_000n * M);
  });

  it("refuses a payee that is not on the list", async () => {
    const a = await account();
    const out = await a.execute(pay(10n, demoTronAddress("stranger")), "stranger");
    expect(out.status === "refused" && out.refusal.code).toBe("policy_destination_denied");
  });

  it("counts spending across payments and refuses past the weekly cap", async () => {
    const a = await account();
    expect((await a.execute(pay(400n), "w1")).status).toBe("accepted");
    expect((await a.execute(pay(400n), "w2")).status).toBe("accepted");
    const third = await a.execute(pay(400n), "w3");
    expect(third.status === "refused" && third.refusal.code).toBe("spend_budget_exceeded");
    expect((await a.execute(pay(200n), "w4")).status).toBe("accepted"); // exactly at the cap
    expect((await a.status()).spentThisWeekUsd).toBe(1000n * M);
  });

  it("refused attempts do not count against the weekly cap", async () => {
    const a = await account();
    await a.execute(pay(10n, demoTronAddress("stranger")), "x");
    expect((await a.status()).spentThisWeekUsd).toBe(0n);
  });

  it("refuses everything while frozen, and pays again once unfrozen", async () => {
    const a = await account();
    await setFrozen(t.db, owner, true);
    const out = await a.execute(pay(1n), "frozen");
    expect(out.status === "refused" && out.refusal.code).toBe("wallet_frozen");
    await setFrozen(t.db, owner, false);
    expect((await a.execute(pay(1n), "unfrozen")).status).toBe("accepted");
  });

  it("preview moves nothing", async () => {
    const a = await account();
    expect((await a.preview(pay(100n))).status).toBe("accepted");
    expect((await a.preview(pay(500n))).status).toBe("refused");
    expect((await a.status()).balances[USDT_TRON.assetId]).toBe(3_000n * M);
    expect(await t.db.accountAction.count()).toBe(0);
  });
});
