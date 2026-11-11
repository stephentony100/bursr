import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "./agent/engine";
import { needsYou } from "./agent/view";
import { demoTronAddress } from "./demo-addresses";
import { loadSampleBusiness } from "./demo-loader";
import { approveInvite, createInvite, submitInvite } from "./invites";
import { demoOwner } from "./owner";
import { payOnce } from "./owner-actions";
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
});
