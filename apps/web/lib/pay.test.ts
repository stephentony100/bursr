import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { agentAccount } from "./agent-account";
import { loadSampleBusiness } from "./demo-loader";
import { approvePlan, approvePlanItem, changePayout, removePlanItem, setFrozen } from "./owner-actions";
import { demoOwner } from "./owner";
import { advanceSimulatedPayments, payApprovedPlan } from "./pay";
import { getPlan, prepareWeeklyPlan } from "./plans";
import type { quotePayout } from "./quotes";
import { amountOutFor } from "./quotes";
import { getBusiness } from "./store";
import { demoTronAddress } from "./demo-addresses";
import { createTestDb } from "./test-db";

// PRD §9 in practice mode: the week's plan, one-tap approval, payments through
// the agent account, and the account's own limits holding.

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();

/** Stand-in for 1Click dry quotes: 1% fee on top, so swaps cost a bit more than they deliver. */
const fakeQuote: typeof quotePayout = async (_treasury, payout, amountUsd) => {
  const out = amountOutFor(amountUsd, payout.token);
  return {
    ok: true,
    quote: { amountIn: ((out * 101n) / 100n).toString(), minAmountIn: out.toString(), amountOut: out.toString(), withdrawFee: "0", timeEstimateSec: 10, at: new Date().toISOString() },
  };
};

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

const M = 1_000_000n;

describe("weekly plan → approval → payment (practice mode)", () => {
  it("the sample week: 3 staff + 2 suppliers in the plan, 4 held with reasons, under the cap", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    const inPlan = plan.items.filter((i) => i.placement === "in");
    expect(inPlan.map((i) => i.payeeName).sort()).toEqual(
      ["Amaka Eze (cashier)", "Bisi Adeyemi (head chef)", "Ikeja Gas & Charcoal", "Mama Put Farms Ltd", "Tunde Okafor (server)"].sort(),
    );
    expect(inPlan.every((i) => !i.needsOwnTap && i.quote)).toBe(true);
    expect(inPlan.reduce((a, i) => a + i.amountUsd, 0n)).toBe(658n * M); // 220+110+120 wages, 118+90 invoices
    const held = plan.items.filter((i) => i.placement === "held");
    expect(held).toHaveLength(4);
    expect(held.every((i) => i.reason && i.reason.length > 10)).toBe(true);
  });

  it("one tap approves the plan; every payment goes through the account and is delivered", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await approvePlan(t.db, owner, plan.id);
    const account = await agentAccount(t.db);
    const before = (await account.status()).balances;
    await payApprovedPlan(t.db, account, plan.id, fakeQuote);

    const paid = (await getPlan(t.db, plan.id))!.items.filter((i) => i.placement === "in");
    expect(paid.every((i) => i.payStatus === "sent" && i.references.length > 0)).toBe(true);
    const status = await account.status();
    expect(status.spentThisWeekUsd).toBe(658n * M);
    const treasury = (await getBusiness(t.db))!.rules.treasury.assetId;
    expect(before[treasury] - status.balances[treasury]).toBeGreaterThan(658n * M); // swaps cost a little more

    await advanceSimulatedPayments(t.db, new Date(Date.now() + 60_000));
    const after = (await getPlan(t.db, plan.id))!;
    expect(after.items.filter((i) => i.placement === "in").every((i) => i.payStatus === "delivered")).toBe(true);
    expect(after.status).toBe("done");
  });

  it("paying again never pays twice (idempotency)", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await approvePlan(t.db, owner, plan.id);
    const account = await agentAccount(t.db);
    await payApprovedPlan(t.db, account, plan.id, fakeQuote);
    await t.db.planItem.updateMany({ where: { planId: plan.id, placement: "in" }, data: { payStatus: "planned" } }); // simulate a crash before status was saved
    await payApprovedPlan(t.db, account, plan.id, fakeQuote);
    expect((await account.status()).spentThisWeekUsd).toBe(658n * M);
  });

  it("paid invoices and wages do not come back in the next plan", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await approvePlan(t.db, owner, plan.id);
    await payApprovedPlan(t.db, await agentAccount(t.db), plan.id, fakeQuote);
    const next = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    expect(next.items.filter((i) => i.placement === "in")).toHaveLength(0);
  });

  it("a payment that needs its own tap blocks plan approval until tapped or removed", async () => {
    await t.db.payee.updateMany({ where: { name: "Ikeja Gas & Charcoal" }, data: { addedAt: new Date() } }); // a new payee
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    const ikeja = plan.items.find((i) => i.payeeName === "Ikeja Gas & Charcoal")!;
    expect(ikeja.needsOwnTap).toBe(true);
    await expect(approvePlan(t.db, owner, plan.id)).rejects.toThrow(/Approve or remove these first/);
    await approvePlanItem(t.db, owner, ikeja.id);
    await approvePlan(t.db, owner, plan.id);
    expect((await getPlan(t.db, plan.id))!.status).toBe("approved");
  });

  it("a removed item is not paid", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    const tunde = plan.items.find((i) => i.payeeName.startsWith("Tunde"))!;
    await removePlanItem(t.db, owner, tunde.id);
    await approvePlan(t.db, owner, plan.id);
    await payApprovedPlan(t.db, await agentAccount(t.db), plan.id, fakeQuote);
    expect((await getPlan(t.db, plan.id))!.items.find((i) => i.id === tunde.id)!.payStatus).toBe("planned");
    expect((await (await agentAccount(t.db)).status()).spentThisWeekUsd).toBe(548n * M);
  });

  it("re-checked at payment time: frozen after approval → the account refuses, nothing moves", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await approvePlan(t.db, owner, plan.id);
    await setFrozen(t.db, owner, true);
    await payApprovedPlan(t.db, await agentAccount(t.db), plan.id, fakeQuote);
    const items = (await getPlan(t.db, plan.id))!.items.filter((i) => i.placement === "in");
    expect(items.every((i) => i.payStatus === "failed" && i.payReason?.startsWith("The account refused: The account is frozen"))).toBe(true);
    expect((await (await agentAccount(t.db)).status()).spentThisWeekUsd).toBe(0n);
  });

  it("re-checked at payment time: payout changed after approval → not paid", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await approvePlan(t.db, owner, plan.id);
    const tunde = plan.items.find((i) => i.payeeName.startsWith("Tunde"))!;
    await changePayout(t.db, owner, tunde.payeeId, { ...tunde.payout!, address: demoTronAddress("tunde-new") });
    await payApprovedPlan(t.db, await agentAccount(t.db), plan.id, fakeQuote);
    const after = (await getPlan(t.db, plan.id))!.items.find((i) => i.id === tunde.id)!;
    expect(after.payStatus).toBe("failed");
    expect(after.payReason).toContain("payout details changed after the plan was approved");
  });

  it("the agent cannot approve: approval needs the owner's session", async () => {
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await expect(approvePlan(t.db, {} as never, plan.id)).rejects.toThrow(/Only the owner/);
    await expect(payApprovedPlan(t.db, await agentAccount(t.db), plan.id, fakeQuote)).rejects.toThrow(/Only an approved plan/);
  });
});
