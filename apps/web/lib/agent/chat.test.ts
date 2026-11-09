import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { loadSampleBusiness } from "../demo-loader";
import { demoOwner, issueSessionCookie, sessionFromCookie, type OwnerSession } from "../owner";
import { createTestDb } from "../test-db";
import type { quotePayout } from "../quotes";
import { amountOutFor } from "../quotes";
import { chat, confirmCard, ownerWroteAmount } from "./chat";

const fakeQuote: typeof quotePayout = async (_t, payout, amountUsd) => {
  const out = amountOutFor(amountUsd, payout.token);
  return { ok: true, quote: { amountIn: out.toString(), minAmountIn: out.toString(), amountOut: out.toString(), withdrawFee: "0", timeEstimateSec: 10, at: new Date().toISOString() } };
};

// The chat without a NEAR AI key (built-in answers), the amount guard, and cards.
process.env.NEAR_AI_API_KEY = "";
process.env.BURSAR_AGENT = "off";
const t = createTestDb();
afterAll(() => t.close());
const owner = demoOwner();

beforeEach(async () => {
  await t.reset();
  await loadSampleBusiness(t.db);
}, 120_000);

describe("chat with the agent", () => {
  it("only accepts an amount the owner wrote", () => {
    expect(ownerWroteAmount("Pay Bisi a $20 bonus", "20")).toBe(true);
    expect(ownerWroteAmount("pay her 1,250.50 please", "1250.50")).toBe(true);
    expect(ownerWroteAmount("Pay Bisi a bonus", "20")).toBe(false);
    expect(ownerWroteAmount("Pay Bisi $200", "20")).toBe(false);
  });

  it("without a NEAR AI key it answers the built-in questions from real data", async () => {
    const r = await chat(t.db, owner, [{ role: "user", content: "Which invoices are on hold, and why?" }]);
    expect(r.ai).toBe(false);
    expect(r.reply).toContain("Ek0 Fresh Foods");
    const other = await chat(t.db, owner, [{ role: "user", content: "hello" }]);
    expect(other.reply).toMatch(/needs a NEAR AI key/);
  });

  it("an action is a card; confirming it makes the agent act; a card can't be reused by someone else or forged", async () => {
    const r = await chat(t.db, owner, [{ role: "user", content: "Run payday now" }]);
    expect(r.cards).toHaveLength(1);
    const stranger = sessionFromCookie(issueSessionCookie("stranger.near", "ed25519:x")) as OwnerSession;
    await expect(confirmCard(t.db, stranger, r.cards[0].token, fakeQuote)).rejects.toThrow(/someone else/);
    await expect(confirmCard(t.db, owner, r.cards[0].token.replace(/.$/, "x"), fakeQuote)).rejects.toThrow(/expired/);
    const done = await confirmCard(t.db, owner, r.cards[0].token, fakeQuote);
    expect(done).toMatch(/paying \d+ payment/);
    expect(await t.db.planItem.count({ where: { payStatus: "sent" } })).toBeGreaterThan(0);
  });

  it("a card is never accepted as a sign-in cookie", async () => {
    const r = await chat(t.db, owner, [{ role: "user", content: "Run payday now" }]);
    expect(sessionFromCookie(r.cards[0].token)).toBeNull();
  });
});
