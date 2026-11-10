import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadSampleBusiness } from "../demo-loader";
import { approvePlanItem, setFrozen, updatePayeeDetails } from "../owner-actions";
import { demoOwner } from "../owner";
import type { quotePayout } from "../quotes";
import { amountOutFor } from "../quotes";
import { addPracticeMoney } from "../funding";
import { getBusiness } from "../store";
import { createTestDb } from "../test-db";
import { runAgent } from "./engine";

// The agent on its own, in practice mode: it pays routine payments, hands
// exceptions to the owner, waits out problems and never pays twice.

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();

const fakeQuote: typeof quotePayout = async (_treasury, payout, amountUsd) => {
  const out = amountOutFor(amountUsd, payout.token);
  return {
    ok: true,
    quote: { amountIn: ((out * 101n) / 100n).toString(), minAmountIn: out.toString(), amountOut: out.toString(), withdrawFee: "0", timeEstimateSec: 10, at: new Date().toISOString() },
  };
};
const run = (now = new Date()) => runAgent(t.db, { now, dueBy: "payday", quote: fakeQuote });
const agentLog = () => t.db.auditEvent.findMany({ where: { actor: "agent" }, orderBy: { at: "asc" } });

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

describe("the agent on autopilot", () => {
  it("pays the routine payments due by payday on its own and says what it did", async () => {
    const r = await run();
    expect(r.newPayments).toBeGreaterThan(0);
    expect(r.sent).toBe(r.newPayments);
    const plan = await t.db.plan.findFirst({ include: { items: true } });
    expect(plan).toMatchObject({ status: "approved", approvedBy: "agent" });
    expect(plan!.items.every((i) => i.payStatus === "sent" && (i.kind === "fee" || i.dueKey))).toBe(true);
    const log = (await agentLog()).map((e) => e.message);
    expect(log.some((m) => /payments? (is|are) due/.test(m))).toBe(true);
    expect(log.some((m) => m.startsWith("Started paying Bisi Adeyemi (head chef) $220.00 (Weekly pay)"))).toBe(true);
    expect(log.some((m) => m.startsWith("Sent Bisi Adeyemi"))).toBe(true);
  });

  it("running again pays nobody twice", async () => {
    await run();
    const again = await run();
    expect(again.newPayments).toBe(0);
    expect(again.attempted).toBe(0);
  });

  it("a payee you've never approved waits for your OK; once you OK it, the agent pays it", async () => {
    await t.db.payee.updateMany({ where: { name: "Bisi Adeyemi (head chef)" }, data: { trustedAt: null } });
    const r = await run();
    expect(r.needsOwner).toBe(1);
    const bisi = await t.db.planItem.findFirst({ where: { payeeName: "Bisi Adeyemi (head chef)" } });
    expect(bisi).toMatchObject({ payStatus: "planned", needsOwnTap: true });
    expect((await agentLog()).some((e) => e.kind === "needs_owner" && e.message.includes("Bisi"))).toBe(true);

    await approvePlanItem(t.db, owner, bisi!.id);
    const next = await run();
    expect(next.sent).toBe(1);
    expect(await t.db.payee.findFirst({ where: { name: "Bisi Adeyemi (head chef)" } })).toMatchObject({ trustedAt: expect.any(Date) });
  });

  it("paused: nothing goes out; back on: the agent picks the payments up again", async () => {
    await setFrozen(t.db, owner, true);
    const paused = await run();
    expect(paused.attempted).toBe(0);
    await setFrozen(t.db, owner, false);
    const back = await run();
    expect(back.sent).toBeGreaterThan(0);
  });

  it("not enough money: the payments wait, and go out by themselves once money arrives", async () => {
    const treasury = (await getBusiness(t.db))!.rules.treasury.assetId;
    await t.db.agentAccount.update({ where: { id: "main" }, data: { simBalances: JSON.stringify({ [treasury]: "1000000" }) } }); // $1
    const now = new Date();
    const short = await run(now);
    expect(short.sent).toBe(0);
    const waiting = await t.db.planItem.findMany({ where: { payStatus: "waiting" } });
    expect(waiting.length).toBeGreaterThan(0);
    expect(waiting.every((i) => i.payCode === "funds" && i.payReason?.includes("add money"))).toBe(true);

    // Still short a minute later: no new attempts, no noise.
    const quiet = await run(new Date(now.getTime() + 3 * 60_000));
    expect(quiet.attempted).toBe(0);

    await t.db.agentAccount.update({ where: { id: "main" }, data: { simBalances: JSON.stringify({ [treasury]: "6000000000" }) } }); // money arrives
    // Paid in the same run that notices the money, not on a later check.
    const paid = await run(new Date(now.getTime() + 3 * 60_000 + 1000));
    expect(paid.sent).toBe(waiting.length);
    expect((await agentLog()).some((e) => /Trying the \d+ payments that were waiting for money now/.test(e.message))).toBe(true);
  });

  it("warns before payday when the wallet is short, and says when money arrives", async () => {
    const treasury = (await getBusiness(t.db))!.rules.treasury.assetId;
    await t.db.agentAccount.update({ where: { id: "main" }, data: { simBalances: JSON.stringify({ [treasury]: "1000000" }) } }); // $1
    await t.db.business.update({ where: { id: "main" }, data: { rules: JSON.stringify({ ...(await getBusiness(t.db))!.rules, autopilot: false }) } });
    const wednesday = new Date("2026-11-11T09:00:00Z"); // payday is Friday 13 Nov
    await runAgent(t.db, { now: wednesday, quote: fakeQuote });
    const warn = (await agentLog()).find((e) => e.kind === "needs_money");
    expect(warn?.message).toMatch(/Payday \(Fri 13 Nov\) needs \$\d.* holds \$1\.00\. Please add/);

    await addPracticeMoney(t.db, "500");
    await runAgent(t.db, { now: wednesday, quote: fakeQuote });
    expect((await agentLog()).some((e) => e.kind === "money_in" && e.message.startsWith("Your Bursar wallet received $500.00"))).toBe(true);
  });

  it("changing someone's regular pay updates their payment that is still waiting", async () => {
    const treasury = (await getBusiness(t.db))!.rules.treasury.assetId;
    await t.db.agentAccount.update({ where: { id: "main" }, data: { simBalances: JSON.stringify({ [treasury]: "1000000" }) } }); // $1: everything waits
    await run();
    const bisi = (await t.db.payee.findFirst({ where: { name: "Bisi Adeyemi (head chef)" } }))!;
    const before = (await t.db.planItem.findFirst({ where: { payeeId: bisi.id, kind: "wages" } }))!;
    expect(before).toMatchObject({ payStatus: "waiting", amountUsd: "220000000" });
    await updatePayeeDetails(t.db, owner, bisi.id, { name: bisi.name, category: "staff", prices: [], recurring: { amountUsd: "250000000", every: "week" } });
    const after = (await t.db.planItem.findUnique({ where: { id: before.id } }))!;
    expect(after).toMatchObject({ amountUsd: "250000000", retryAt: null, attempts: before.attempts + 1 });
    await updatePayeeDetails(t.db, owner, bisi.id, { name: bisi.name, category: "staff", prices: [], recurring: null });
    expect((await t.db.planItem.findUnique({ where: { id: before.id } }))!.placement).toBe("removed");
  });
});
