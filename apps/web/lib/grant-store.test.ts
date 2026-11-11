import { randomBytes } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// The Agent API is faked: these tests cover what Bursr does with its answers.
const fake = vi.hoisted(() => ({
  generateIntent: vi.fn(async (b: { type: string; agent_id?: string }) => ({
    correlation_id: `corr-${b.type}-${Math.random()}`,
    agent_id: b.agent_id ?? "agent-1",
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    intent: {},
    preview: { summary: "test" },
  })),
  submitIntent: vi.fn(async () => ({})),
  getStatus: vi.fn(async () => ({ status: "SUCCESS", failure_code: null })),
  getPolicy: vi.fn(async () => ({ policy: null, revision: 2 })),
}));
vi.mock("@near-intents-agent-api/sdk", async (orig) => ({
  ...(await orig<typeof import("@near-intents-agent-api/sdk")>()),
  createAgentApi: () => fake,
  createGrantCredential: () => ({ token: "ngt_test_secret_pass", commitment: "commitment" }),
}));

import { liveAgentConfig } from "./agent-account";
import { grantState, openGrant, readGrant, sealGrant } from "./grant-store";
import { issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { policyNeedsSigning, setupBusiness } from "./owner-actions";
import { prepareOwnerIntent, submitOwnerIntent } from "./owner-intents";
import { getAccountRecord, getBusiness } from "./store";
import { createTestDb } from "./test-db";
import { rules } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());

const KEY_HEX = randomBytes(32).toString("hex");
process.env.BURSAR_DATA_KEY = KEY_HEX;
process.env.AGENT_API_KEY = "test-partner-key";
delete process.env.AGENT_API_AGENT_ID;
const key = Buffer.from(KEY_HEX, "hex");
const owner = sessionFromCookie(issueSessionCookie("owner.near", "ed25519:x")) as OwnerSession;

describe("sealing the payment pass", () => {
  it("opens with the same key and agent", () => {
    const sealed = sealGrant("ngt_abc", "agent-1", key);
    expect(sealed).not.toContain("ngt_abc");
    expect(openGrant(sealed, "agent-1", key)).toBe("ngt_abc");
  });

  it("refuses a wrong key, another agent, or tampered data", () => {
    const sealed = sealGrant("ngt_abc", "agent-1", key);
    expect(() => openGrant(sealed, "agent-1", randomBytes(32))).toThrow(/can't read its payment pass/);
    expect(() => openGrant(sealed, "agent-2", key)).toThrow(/can't read its payment pass/);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => openGrant(parts.join("."), "agent-1", key)).toThrow(/can't read its payment pass/);
  });

  it("knows when a pass is missing, usable, ending soon or expired", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const day = 24 * 60 * 60 * 1000;
    const rec = (ms: number) => ({ grantSealed: "v1.x.y.z", grantExpiresAt: new Date(now.getTime() + ms) });
    expect(grantState(null, now).usable).toBe(false);
    expect(grantState(rec(20 * day), now)).toMatchObject({ usable: true, renewSoon: false });
    expect(grantState(rec(2 * day), now)).toMatchObject({ usable: true, renewSoon: true });
    expect(grantState(rec(-1), now).usable).toBe(false);
    expect(() => readGrant({ agentId: "a", ...rec(-1) }, now, key)).toThrow(/run out/);
  });
});

describe("onboarding in live mode", () => {
  beforeEach(async () => {
    await t.reset();
    vi.clearAllMocks();
    await setupBusiness(t.db, owner, { name: "Corner Shop", rules: rules() });
    await t.db.agentAccount.create({ data: { backend: "agent-api", agentId: "agent-1", policy: "{}", policyRevision: 1 } });
  });

  it("stores the pass sealed after the owner's OK, never in plain text or the log", async () => {
    const p = await prepareOwnerIntent(t.db, owner, "grant_issue");
    const out = await submitOwnerIntent(t.db, owner, { kind: "grant_issue", correlationId: p.correlationId, agentId: "someone-else", signedData: {} as never });
    expect(out).toEqual({ status: "SUCCESS", failureCode: null });

    const row = await t.db.agentAccount.findUnique({ where: { id: "main" } });
    expect(row?.grantSealed).toBeTruthy();
    expect(row?.grantSealed).not.toContain("ngt_test_secret_pass");
    expect(row?.grantExpiresAt?.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    const log = await t.db.auditEvent.findMany();
    expect(JSON.stringify(log)).not.toContain("ngt_test_secret_pass");
    // Bound to the agent on record, not the id the browser sent.
    expect((await liveAgentConfig(t.db)).grantToken).toBe("ngt_test_secret_pass");
  });

  it("refuses to submit a pass it no longer holds (restart between prepare and OK)", async () => {
    const out = await submitOwnerIntent(t.db, owner, { kind: "grant_issue", correlationId: "unknown", agentId: "agent-1", signedData: {} as never });
    expect(out.status).toBe("FAILED");
    expect(fake.submitIntent).not.toHaveBeenCalled();
  });

  it("will not prepare a pass without BURSAR_DATA_KEY", async () => {
    process.env.BURSAR_DATA_KEY = "";
    await expect(prepareOwnerIntent(t.db, owner, "grant_issue")).rejects.toThrow(/BURSAR_DATA_KEY/);
    process.env.BURSAR_DATA_KEY = KEY_HEX;
  });

  it("live mode has no agent to act as before a pass exists", async () => {
    await expect(liveAgentConfig(t.db)).rejects.toThrow(/isn't allowed to make payments yet/);
  });

  it("a pause from the wallet sticks: the rules say paused and nothing waits to be signed", async () => {
    const p = await prepareOwnerIntent(t.db, owner, "agent_freeze");
    await submitOwnerIntent(t.db, owner, { kind: "agent_freeze", correlationId: p.correlationId, agentId: "agent-1", signedData: {} as never });
    expect((await getBusiness(t.db))?.rules.frozen).toBe(true);
    expect((await getAccountRecord(t.db))?.policy).toMatchObject({ frozen: true });
    expect(await policyNeedsSigning(t.db)).toBe(false);
  });
});
