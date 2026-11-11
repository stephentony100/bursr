import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "./agent/engine";
import { loadSampleBusiness } from "./demo-loader";
import { demoOwner } from "./owner";
import { payOnce } from "./owner-actions";
import type { quotePayout } from "./quotes";
import { amountOutFor } from "./quotes";
import { getBusiness } from "./store";
import { createTestDb } from "./test-db";

// The business pays the network fee: the person receives the full amount owed.

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();
const FEE = 20_000n; // $0.02 in a 6-decimal stablecoin

/** A 1Click quote whose withdrawal fee is already inside amountIn (as 1Click documents). */
const feeQuote: typeof quotePayout = async (_t, payout, amountUsd) => {
  const out = amountOutFor(amountUsd, payout.token);
  return { ok: true, quote: { amountIn: (out + FEE).toString(), minAmountIn: (out + FEE).toString(), amountOut: out.toString(), withdrawFee: FEE.toString(), timeEstimateSec: 1, at: new Date().toISOString() } };
};

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

describe("network fees", () => {
  it("sends the amount owed plus the fee, records the fee, and they receive the full amount", async () => {
    const base = (await getBusiness(t.db))!.rules.payoutTokens.find((x) => x.chain === "base")!;
    await payOnce(t.db, owner, { name: "Kola Supplies", amountUsd: 100_000n, note: "Ice", payout: { token: base, address: "0x" + "12".repeat(20), memo: null }, removeAfterPaid: false });
    await runAgent(t.db, { quote: feeQuote });
    const item = (await t.db.planItem.findFirst({ where: { kind: "one_off" } }))!;
    expect(item.payStatus).toBe("sent");
    expect(item.amountReceived).toBe("100000");
    expect(item.networkFee).toBe(FEE.toString());
    expect(item.amountSent).toBe((100_000n + FEE).toString());
    const sending = await t.db.auditEvent.findFirst({ where: { kind: "payment_sent" } });
    expect(sending?.message).toContain("$0.10");
  });

  it("the fee counts toward the largest single payment", async () => {
    const business = (await getBusiness(t.db))!;
    const base = business.rules.payoutTokens.find((x) => x.chain === "base")!;
    const cap = BigInt(business.rules.perPaymentCapUsd);
    await payOnce(t.db, owner, { name: "Right At The Limit", amountUsd: cap, note: "Job", payout: { token: base, address: "0x" + "34".repeat(20), memo: null }, removeAfterPaid: false });
    await runAgent(t.db, { quote: feeQuote });
    const item = (await t.db.planItem.findFirst({ where: { kind: "one_off" } }))!;
    expect(item.payStatus).toBe("failed");
    expect(item.payReason).toMatch(/network fee/);
  });
});
