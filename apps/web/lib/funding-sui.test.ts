import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// One tap from a Sui wallet: what the owner's wallet is asked to sign comes
// from the token list and the Agent API, never from the browser.

const COIN = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const SUI_USDC_ASSET = "nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near";
const fake = vi.hoisted(() => ({
  getTokens: vi.fn(async () => [{ asset_id: "nep141:sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near", symbol: "USDC", blockchain: "sui", decimals: 6 }]),
  deposit: vi.fn(async () => ({ details: { deposit_address: "0xdeposit", min_amount: "1000000", expires_at: null } })),
}));
vi.mock("@near-intents-agent-api/sdk", async (orig) => ({ ...(await orig<typeof import("@near-intents-agent-api/sdk")>()), createAgentApi: () => fake }));
vi.mock("./oneclick", async (orig) => ({
  ...(await orig<typeof import("./oneclick")>()),
  getTokens: async () => [{ assetId: SUI_USDC_ASSET, decimals: 6, blockchain: "sui", symbol: "USDC", price: 1, contractAddress: COIN }],
}));

import { suiOneTap } from "./funding";
import { issueSessionCookie, sessionFromCookie, type OwnerSession } from "./owner";
import { setupBusiness } from "./owner-actions";
import { createTestDb } from "./test-db";
import { rules } from "./test-fixtures";

const t = createTestDb();
afterAll(() => t.close());
process.env.AGENT_API_KEY = "test-partner-key";
const address = `0x${"98d4".repeat(16)}`;
const owner = sessionFromCookie(issueSessionCookie(`sui:${address}`, "")) as OwnerSession;

beforeEach(async () => {
  await t.reset();
  vi.clearAllMocks();
  await setupBusiness(t.db, owner, { name: "Stak", rules: rules() });
  await t.db.agentAccount.create({ data: { backend: "agent-api", agentId: "agent-1", policy: "{}", policyRevision: 1 } });
});

describe("one tap from a Sui wallet", () => {
  it("gives a fresh confidential deposit address, USDC's coin type from the token list and the owner's own address", async () => {
    const d = await suiOneTap(t.db, owner.accountId);
    expect(d).toEqual({ depositAddress: "0xdeposit", minimumUnits: "1000000", coinType: COIN, decimals: 6, ownerAddress: address });
    expect(fake.deposit).toHaveBeenCalledWith("agent-1", expect.objectContaining({ origin_asset: SUI_USDC_ASSET, confidential: true }), expect.anything());
  });

  it("is only for owners who signed in with Sui", async () => {
    await expect(suiOneTap(t.db, "owner.near")).rejects.toThrow(/signed in with Sui/);
    expect(fake.deposit).not.toHaveBeenCalled();
  });
});
