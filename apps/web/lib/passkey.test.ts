import { generateKeyPairSync } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// The Agent API is faked: these tests cover what Bursr sends as the agent's owner.
const fake = vi.hoisted(() => ({
  generateIntent: vi.fn(async (b: { type: string; agent_id?: string }) => ({
    correlation_id: `corr-${b.type}`,
    agent_id: b.agent_id ?? "agent-1",
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    intent: { standard: "webauthn", payload: {} },
    preview: { summary: "test" },
  })),
}));
vi.mock("@near-intents-agent-api/sdk", async (orig) => ({
  ...(await orig<typeof import("@near-intents-agent-api/sdk")>()),
  createAgentApi: () => fake,
}));

import { issueSessionCookie, sealPayload, sessionFromCookie, type OwnerSession } from "./owner";
import { setupBusiness } from "./owner-actions";
import { prepareOwnerIntent } from "./owner-intents";
import { getOwnerPasskey, passkeyConfig, registrationOptions, spkiFromCose, verifyRegistration, type OwnerPasskey } from "./passkey";
import { createTestDb } from "./test-db";
import { rules } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());

process.env.AGENT_API_KEY = "test-partner-key";
process.env.NEXT_PUBLIC_APP_URL = "https://bursr.xyz";
delete process.env.BURSAR_PASSKEY_RP_ID;
const owner = sessionFromCookie(issueSessionCookie("owner.near", "ed25519:x")) as OwnerSession;
const stranger = sessionFromCookie(issueSessionCookie("stranger.near", "ed25519:y")) as OwnerSession;

const passkey: OwnerPasskey = {
  credentialId: "cred-abc",
  publicKey: "MFkw-spki",
  rpId: "bursr.xyz",
  origin: "https://bursr.xyz",
  backedUp: true,
  createdAt: "2026-11-17T00:00:00.000Z",
};

describe("passkey domain", () => {
  it("uses the site's hostname and origin, or a parent domain", () => {
    expect(passkeyConfig({ NEXT_PUBLIC_APP_URL: "https://bursr.xyz", BURSAR_PASSKEY_RP_ID: undefined })).toEqual({ rpId: "bursr.xyz", origin: "https://bursr.xyz" });
    expect(passkeyConfig({ NEXT_PUBLIC_APP_URL: "https://app.bursr.xyz/", BURSAR_PASSKEY_RP_ID: "bursr.xyz" })).toEqual({ rpId: "bursr.xyz", origin: "https://app.bursr.xyz" });
  });

  it("refuses http and a domain the site isn't under", () => {
    expect(() => passkeyConfig({ NEXT_PUBLIC_APP_URL: "http://localhost:3000", BURSAR_PASSKEY_RP_ID: undefined })).toThrow(/https/);
    expect(() => passkeyConfig({ NEXT_PUBLIC_APP_URL: "https://evilbursr.xyz", BURSAR_PASSKEY_RP_ID: "bursr.xyz" })).toThrow(/hostname or a parent domain/);
  });
});

describe("COSE to SPKI (the key format the Agent API takes)", () => {
  it("gives the same DER SPKI as the key itself", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = publicKey.export({ format: "jwk" });
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(jwk.x!, "base64url")],
        [-3, Buffer.from(jwk.y!, "base64url")],
      ]),
    );
    expect(spkiFromCose(cose as Uint8Array<ArrayBuffer>)).toBe(publicKey.export({ format: "der", type: "spki" }).toString("base64url"));
  });
});

describe("the passkey that owns a new agent wallet", () => {
  beforeEach(async () => {
    await t.reset();
    vi.clearAllMocks();
    await setupBusiness(t.db, owner, { name: "Corner Shop", rules: rules() });
  });

  it("asks the device for an ES256 passkey with user verification, for this site only", async () => {
    const { options, sealedChallenge } = await registrationOptions(t.db, owner);
    expect(options.rp).toEqual({ name: "Bursr", id: "bursr.xyz" });
    expect(options.pubKeyCredParams).toEqual([{ type: "public-key", alg: -7 }]);
    expect(options.authenticatorSelection?.userVerification).toBe("required");
    expect(sealedChallenge).not.toContain(options.challenge);
  });

  it("only the business's owner can create it", async () => {
    await expect(registrationOptions(t.db, stranger)).rejects.toThrow(/Only the owner/);
  });

  it("can't be created or replaced once the agent's wallet exists", async () => {
    await t.db.agentAccount.create({ data: { backend: "agent-api", agentId: "agent-1", policy: "{}", policyRevision: 1 } });
    await expect(registrationOptions(t.db, owner)).rejects.toThrow(/can't be changed/);
  });

  it("refuses an answer without its challenge, or with another owner's", async () => {
    const response = { id: "x", rawId: "x", type: "public-key", response: {}, clientExtensionResults: {} } as never;
    await expect(verifyRegistration(t.db, owner, response, undefined)).rejects.toThrow(/took too long/);
    const others = sealPayload({ k: "passkey_reg", challenge: "c", owner: "stranger.near" }, 60_000);
    await expect(verifyRegistration(t.db, owner, response, others)).rejects.toThrow(/took too long/);
    const card = sealPayload({ challenge: "c", owner: "owner.near" }, 60_000);
    await expect(verifyRegistration(t.db, owner, response, card)).rejects.toThrow(/took too long/);
    expect(await getOwnerPasskey(t.db)).toBeNull();
  });

  it("agent_create names the passkey as the owner", async () => {
    await t.db.business.update({ where: { id: "main" }, data: { ownerPasskey: JSON.stringify(passkey) } });
    await prepareOwnerIntent(t.db, owner, "agent_create");
    expect(fake.generateIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "agent_create",
        owner: { type: "passkey", credential_id: "cred-abc", public_key: "MFkw-spki", rp_id: "bursr.xyz", origin: "https://bursr.xyz" },
      }),
    );
  });

  it("agent_create waits for the passkey", async () => {
    await expect(prepareOwnerIntent(t.db, owner, "agent_create")).rejects.toThrow(/Create your passkey first/);
    expect(fake.generateIntent).not.toHaveBeenCalled();
  });
});
