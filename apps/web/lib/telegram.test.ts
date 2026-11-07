import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadSampleBusiness } from "./demo-loader";
import { approvePlan } from "./owner-actions";
import { demoOwner, issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { getPlan, prepareWeeklyPlan } from "./plans";
import { amountOutFor, type quotePayout } from "./quotes";
import { createLinkCode, linkChat, markSent, ownerForChat, pendingAlerts, planText } from "./telegram";
import { createTestDb } from "./test-db";

const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();
const fakeQuote: typeof quotePayout = async (_t, payout, usd) => {
  const out = amountOutFor(usd, payout.token).toString();
  return { ok: true, quote: { amountIn: out, minAmountIn: out, amountOut: out, withdrawFee: "0", timeEstimateSec: 5, at: new Date().toISOString() } };
};

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

describe("Telegram", () => {
  it("only the owner can make a link code", async () => {
    const stranger = sessionFromCookie(issueSessionCookie("stranger.near", "ed25519:x")) as OwnerSession;
    await expect(createLinkCode(t.db, stranger)).rejects.toThrow(/Only the owner/);
    expect(await createLinkCode(t.db, owner)).toMatch(/^[0-9A-F]{8}$/);
  });

  it("links a chat with the right code, once; wrong or expired codes do nothing", async () => {
    const code = await createLinkCode(t.db, owner, Date.now());
    expect(await linkChat(t.db, 111, "WRONG")).toMatch(/wrong or expired/);
    expect(await linkChat(t.db, 111, code, Date.now() + 11 * 60_000)).toMatch(/wrong or expired/);
    expect(await linkChat(t.db, 111, code.toLowerCase())).toMatch(/^Connected/);
    expect(await linkChat(t.db, 222, code)).toMatch(/wrong or expired/); // used up
  });

  it("five wrong codes cancel the pending code (no guessing)", async () => {
    const code = await createLinkCode(t.db, owner);
    for (let i = 0; i < 4; i++) expect(await linkChat(t.db, 999, "00000000")).toMatch(/wrong or expired/);
    expect(await linkChat(t.db, 999, "00000000")).toMatch(/Too many wrong codes/);
    expect(await linkChat(t.db, 111, code)).toMatch(/wrong or expired/); // the real code no longer works
  });

  it("only the linked chat acts as the owner", async () => {
    await linkChat(t.db, 111, await createLinkCode(t.db, owner));
    expect(await ownerForChat(t.db, 222)).toBeNull();
    const chatOwner = await ownerForChat(t.db, 111);
    expect(chatOwner?.accountId).toBe("demo-owner.near");
    const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
    await approvePlan(t.db, chatOwner!, plan.id);
    expect((await getPlan(t.db, plan.id))!.status).toBe("approved");
  });

  it("the plan message lists payments and what is held, in plain words", async () => {
    const text = planText(await prepareWeeklyPlan(t.db, new Date(), fakeQuote));
    expect(text).toMatch(/^This week's plan: \$661\.29 in 6 payments/);
    expect(text).toContain("Not in this plan (4):");
    expect(text).toContain("Name looks like Eko Fresh Foods but is not Eko Fresh Foods");
  });

  it("each alert is sent once (idempotent by key)", async () => {
    const first = await pendingAlerts(t.db);
    expect(first.map((a) => a.text.split(":")[0])).toEqual(["🚫 Blocked", "⏸ On hold", "🚫 Blocked", "⏸ On hold"]);
    for (const a of first) await markSent(t.db, a.key);
    await markSent(t.db, first[0].key); // a retry is harmless
    expect(await pendingAlerts(t.db)).toEqual([]);
  });
});
