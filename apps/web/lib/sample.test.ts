import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SimulatedAccount } from "./agent-account/simulated";
import { demoNearImplicit } from "./demo-addresses";
import { loadSampleBusiness } from "./demo-loader";
import { setFrozen } from "./owner-actions";
import { demoOwner } from "./owner";
import { getBusiness, listPayees } from "./store";
import { createTestDb } from "./test-db";

// The sample restaurant behind the README's "Test the rules" steps.

const t = createTestDb();
afterAll(() => t.close());

let account: SimulatedAccount;
let farm: { asset: string; chain: string; address: string };
const M = 1_000_000n;

beforeAll(async () => {
  await loadSampleBusiness(t.db);
  const business = (await getBusiness(t.db))!;
  const tokens = [business.rules.treasury, ...business.rules.payoutTokens];
  account = new SimulatedAccount(t.db, Object.fromEntries(tokens.map((x) => [x.assetId, x.decimals])));
  const p = (await listPayees(t.db)).find((x) => x.name === "Mama Put Farms Ltd")!;
  farm = { asset: p.payout.token.assetId, chain: p.payout.token.chain, address: p.payout.address };
}, 120_000);

const pay = (dollars: bigint, recipient = farm.address) =>
  ({ kind: "withdraw", asset: farm.asset, amount: dollars * M, chain: farm.chain, recipient }) as const;

describe("sample restaurant", () => {
  it("has six payees and $2,500 / $900 / $600 rules", async () => {
    const b = (await getBusiness(t.db))!;
    expect(await listPayees(t.db)).toHaveLength(6);
    expect([b.rules.weeklyCapUsd, b.rules.perPaymentCapUsd, b.rules.approvalThresholdUsd]).toEqual([
      (2500n * M).toString(),
      (900n * M).toString(),
      (600n * M).toString(),
    ]);
    expect((await account.status()).balances[b.rules.treasury.assetId]).toBe(6000n * M);
  });

  it("a normal $50 payment to Mama Put Farms is allowed", async () => {
    expect((await account.preview(pay(50n))).status).toBe("accepted");
  });

  it("$901 is refused: above the $900 per-payment cap", async () => {
    const out = await account.preview(pay(901n));
    expect(out.status === "refused" && out.refusal.message).toBe("This is more than your $900.00 limit for a single payment.");
  });

  it("an address not on the list is refused", async () => {
    const out = await account.preview(pay(50n, demoNearImplicit("not-a-payee")));
    expect(out.status === "refused" && out.refusal.code).toBe("policy_destination_denied");
  });

  it("frozen: even a normal payment is refused; unfrozen: allowed again", async () => {
    await setFrozen(t.db, demoOwner(), true);
    const out = await account.preview(pay(50n));
    expect(out.status === "refused" && out.refusal.code).toBe("wallet_frozen");
    await setFrozen(t.db, demoOwner(), false);
    expect((await account.preview(pay(50n))).status).toBe("accepted");
  });

  it("loading the demo again replaces the demo data", async () => {
    await loadSampleBusiness(t.db);
    expect(await listPayees(t.db)).toHaveLength(6);
  });
});
