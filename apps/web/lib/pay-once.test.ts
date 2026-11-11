import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "./agent/engine";
import { needsYou } from "./agent/view";
import { demoTronAddress } from "./demo-addresses";
import { loadSampleBusiness } from "./demo-loader";
import { approveInvite, createInvite, submitInvite } from "./invites";
import { demoOwner } from "./owner";
import { cancelPayment, changePayout, payOnce, retryPayment } from "./owner-actions";
import type { quotePayout } from "./quotes";
import { amountOutFor } from "./quotes";
import { getBusiness, listPayees } from "./store";
import { createTestDb } from "./test-db";

// "Pay someone once": a quick job paid by the agent, then the person comes off the list.

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();
const fakeQuote: typeof quotePayout = async (_t, payout, amountUsd) => {
  const out = amountOutFor(amountUsd, payout.token);
  return { ok: true, quote: { amountIn: out.toString(), minAmountIn: out.toString(), amountOut: out.toString(), withdrawFee: "0", timeEstimateSec: 1, at: new Date().toISOString() } };
};

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

describe("pay someone once", () => {
  it("by address (practice): the agent pays at once, and they come off the list once it arrives", async () => {
    const tron = (await getBusiness(t.db))!.rules.payoutTokens.find((x) => x.chain === "tron")!;
    await payOnce(t.db, owner, { name: "Ade (generator repair)", amountUsd: 40_000_000n, note: "Fixing the generator", payout: { token: tron, address: demoTronAddress("ade"), memo: null }, removeAfterPaid: true });
    const first = await runAgent(t.db, { quote: fakeQuote });
    expect(first.sent).toBeGreaterThanOrEqual(1);
    const item = (await t.db.planItem.findFirst({ where: { kind: "one_off" } }))!;
    expect(item).toMatchObject({ payStatus: "sent", forWhat: "Fixing the generator", amountUsd: "40000000" });

    // A couple of minutes later the (practice) payment arrives, and the agent notices on its next run.
    await t.db.planItem.updateMany({ where: { payStatus: "sent" }, data: { sentAt: new Date(Date.now() - 120_000) } });
    await runAgent(t.db, { quote: fakeQuote });
    expect((await listPayees(t.db)).some((p) => p.name.startsWith("Ade"))).toBe(false);
    const log = await t.db.auditEvent.findMany({ where: { actor: "agent" } });
    expect(log.some((e) => e.message.includes("took them off your list"))).toBe(true);
  });

  it("by link: approving their details creates the payment", async () => {
    const invite = await createInvite(t.db, owner, { name: "Chi", category: "supplier", recurring: null, oneOff: { amountUsd: "25000000", note: "Delivery", removeAfterPaid: true } });
    const tron = (await getBusiness(t.db))!.rules.payoutTokens.find((x) => x.chain === "tron")!;
    await submitInvite(t.db, invite.token, { assetId: tron.assetId, address: demoTronAddress("chi"), memo: "" });
    const payeeId = await approveInvite(t.db, owner, invite.id);
    expect(await t.db.planItem.findFirst({ where: { kind: "one_off", payeeId } })).toMatchObject({ amountUsd: "25000000", forWhat: "Delivery", needsOwnTap: false });
    expect((await t.db.payee.findUnique({ where: { id: payeeId } }))!.removeAfterPaid).toBe(true);
  });

  it("live: a payment to someone the wallet hasn't confirmed shows as waiting for the wallet", async () => {
    const tron = (await getBusiness(t.db))!.rules.payoutTokens.find((x) => x.chain === "tron")!;
    await t.db.agentAccount.update({ where: { id: "main" }, data: { backend: "agent-api", agentId: "agent-1" } });
    await payOnce(t.db, owner, { name: "Bola", amountUsd: 10_000_000n, note: "Cleaning", payout: { token: tron, address: demoTronAddress("bola"), memo: null }, removeAfterPaid: true });
    const waiting = (await needsYou(t.db)).find((n) => n.payeeName === "Bola");
    expect(waiting).toMatchObject({ kind: "wallet" });
    expect(waiting!.reason).toMatch(/Waiting for your wallet to confirm Bola/);
  });

  it("a failed payment: change their address (no hold if never paid), try again with a new amount, or cancel", async () => {
    const tokens = (await getBusiness(t.db))!.rules.payoutTokens;
    const tron = tokens.find((x) => x.chain === "tron")!;
    const near = tokens.find((x) => x.chain === "near")!;
    const deonId = await payOnce(t.db, owner, { name: "Deon", amountUsd: 100_000n, note: "Fixing the AC", payout: { token: tron, address: demoTronAddress("deon"), memo: null }, removeAfterPaid: true });
    const item = (await t.db.planItem.findFirst({ where: { payeeId: deonId } }))!;
    await t.db.planItem.update({ where: { id: item.id }, data: { payStatus: "failed", payReason: "Network fee is more than the payment." } });

    // Never paid: the new address applies at once (no 48-hour hold) and the failed payment follows it.
    const { hold } = await changePayout(t.db, owner, deonId, { token: near, address: "deon.near", memo: null });
    expect(hold).toBe(false);
    expect((await t.db.payee.findUnique({ where: { id: deonId } }))!.payoutChangedAt).toBeNull();

    // It fails again; the owner tries once more with a new amount.
    await t.db.planItem.update({ where: { id: item.id }, data: { payStatus: "failed", payReason: "Something went wrong." } });
    await retryPayment(t.db, owner, item.id, 5_000_000n);
    const retried = (await t.db.planItem.findUnique({ where: { id: item.id } }))!;
    expect(retried).toMatchObject({ payStatus: "planned", amountUsd: "5000000", payReason: null });
    expect(JSON.parse(retried.payout).address).toBe("deon.near");
    const r = await runAgent(t.db, { quote: fakeQuote });
    expect(r.sent).toBeGreaterThanOrEqual(1);
  });

  it("changing a never-paid person's address puts their failed payment back in the queue", async () => {
    const tokens = (await getBusiness(t.db))!.rules.payoutTokens;
    const tron = tokens.find((x) => x.chain === "tron")!;
    const near = tokens.find((x) => x.chain === "near")!;
    const id = await payOnce(t.db, owner, { name: "Deon", amountUsd: 100_000n, note: "Fixing the AC", payout: { token: tron, address: demoTronAddress("deon"), memo: null }, removeAfterPaid: true });
    const item = (await t.db.planItem.findFirst({ where: { payeeId: id } }))!;
    await t.db.planItem.update({ where: { id: item.id }, data: { payStatus: "failed", payReason: "Sending $0.10 to Tron costs about $1." } });
    await changePayout(t.db, owner, id, { token: near, address: "deon.near", memo: null });
    const after = (await t.db.planItem.findUnique({ where: { id: item.id } }))!;
    expect(after).toMatchObject({ payStatus: "planned", payReason: null, attempts: item.attempts + 1 });
    expect(JSON.parse(after.payout).address).toBe("deon.near");
    expect((await needsYou(t.db)).some((n) => n.kind === "failed")).toBe(false);
    expect((await runAgent(t.db, { quote: fakeQuote })).sent).toBeGreaterThanOrEqual(1);
  });

  it("cancelling a one-time payment takes the person off the list", async () => {
    const tron = (await getBusiness(t.db))!.rules.payoutTokens.find((x) => x.chain === "tron")!;
    const id = await payOnce(t.db, owner, { name: "Femi", amountUsd: 100_000n, note: "Errand", payout: { token: tron, address: demoTronAddress("femi"), memo: null }, removeAfterPaid: true });
    const item = (await t.db.planItem.findFirst({ where: { payeeId: id } }))!;
    await t.db.planItem.update({ where: { id: item.id }, data: { payStatus: "failed" } });
    await cancelPayment(t.db, owner, item.id);
    expect((await listPayees(t.db)).some((p) => p.name === "Femi")).toBe(false);
  });

  it("someone you've paid before keeps the 48-hour hold when their address changes", async () => {
    const bisi = (await listPayees(t.db)).find((p) => p.name.startsWith("Bisi"))!;
    await t.db.planItem.create({ data: { plan: { create: { capLeftUsd: "0", status: "done" } }, kind: "wages", payeeId: bisi.id, payeeName: bisi.name, forWhat: "Weekly pay", amountUsd: "1", payout: "{}", placement: "in", payStatus: "delivered" } });
    const { hold } = await changePayout(t.db, owner, bisi.id, { ...bisi.payout, address: "0x" + "ab".repeat(20) });
    expect(hold).toBe(true);
  });
});
