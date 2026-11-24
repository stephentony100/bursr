import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { describe, expect, it } from "vitest";
import { checkChallenge, issueSessionCookie, newChallenge, sessionFromCookie } from "./owner";
import { ownerChain, ownerLabel } from "./owner-id";
import { suiSignInMessage, verifySuiSignIn } from "./sui-signin";

// A real Sui keypair signs the personal message, as a wallet would.
const owner = new Ed25519Keypair();
const stranger = new Ed25519Keypair();

async function signIn(kp: Ed25519Keypair, text: (nonce: string) => string = (n) => suiSignInMessage(n)) {
  const { nonce, token } = newChallenge();
  const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(text(nonce)));
  return { nonce, token, signature };
}

describe("signing in with a Sui wallet", () => {
  it("accepts the owner's signature over Bursr's message and returns a sui: owner ID", async () => {
    const { token, signature } = await signIn(owner);
    const id = await verifySuiSignIn({ token, address: owner.toSuiAddress(), signature });
    expect(id).toBe(`sui:${owner.toSuiAddress()}`);
    expect(id).toMatch(/^sui:0x[0-9a-f]{64}$/);
  });

  it("refuses a signature from another wallet than the address claimed", async () => {
    const { token, signature } = await signIn(stranger);
    await expect(verifySuiSignIn({ token, address: owner.toSuiAddress(), signature })).rejects.toThrow(/Signature not accepted/);
  });

  it("refuses a message for another site or another sign-in", async () => {
    const otherSite = await signIn(owner, (n) => suiSignInMessage(n, "evil.example"));
    await expect(verifySuiSignIn({ token: otherSite.token, address: owner.toSuiAddress(), signature: otherSite.signature })).rejects.toThrow(/Signature not accepted/);
    const first = await signIn(owner);
    const second = newChallenge();
    await expect(verifySuiSignIn({ token: second.token, address: owner.toSuiAddress(), signature: first.signature })).rejects.toThrow(/Signature not accepted/);
  });

  it("refuses an expired or forged challenge", async () => {
    const { token, signature } = await signIn(owner);
    await expect(verifySuiSignIn({ token, address: owner.toSuiAddress(), signature }, { now: Date.now() + 6 * 60 * 1000 })).rejects.toThrow(/expired/);
    const forged = `${Buffer.from(`AAAA|${Date.now() + 60_000}`).toString("base64url")}.${token.split(".")[1]}`;
    expect(checkChallenge(forged)).toBeNull();
    await expect(verifySuiSignIn({ token: forged, address: owner.toSuiAddress(), signature })).rejects.toThrow(/expired/);
  });

  it("refuses something that isn't a Sui address", async () => {
    const { token, signature } = await signIn(owner);
    await expect(verifySuiSignIn({ token, address: "alice.near", signature })).rejects.toThrow(/isn't a Sui wallet address/);
    await expect(verifySuiSignIn({ token, address: "0x2", signature })).rejects.toThrow(/isn't a Sui wallet address/);
  });
});

describe("owner IDs across wallet families", () => {
  it("knows the chain and shows a Sui owner shortened", () => {
    const id = `sui:${owner.toSuiAddress()}`;
    expect(ownerChain(id)).toBe("sui");
    expect(ownerChain("alice.near")).toBe("near");
    expect(ownerLabel(id)).toMatch(/^Sui · 0x[0-9a-f]{4}…[0-9a-f]{4}$/);
    expect(ownerLabel("alice.near")).toBe("alice.near");
    expect(ownerLabel("stellar:CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75")).toBe("Your passkey");
    expect(ownerLabel("stellar:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN")).toBe("Stellar · GA5ZSE…KZVN");
  });

  it("a Sui session has its chain and no NEAR key", () => {
    const id = `sui:${owner.toSuiAddress()}`;
    const s = sessionFromCookie(issueSessionCookie(id, ""));
    expect(s).toMatchObject({ accountId: id, chain: "sui", publicKey: null, demo: false });
    expect(sessionFromCookie(issueSessionCookie("alice.near", "ed25519:k"))).toMatchObject({ chain: "near", publicKey: "ed25519:k" });
  });
});
