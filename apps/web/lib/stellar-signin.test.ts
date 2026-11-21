import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { newChallenge } from "./owner";
import { stellarSignInMessage, verifyStellarMessage, verifyStellarSignIn } from "./stellar-signin";

const sep53 = (kp: Keypair, message: string) =>
  Buffer.from(kp.sign(createHash("sha256").update(Buffer.from("Stellar Signed Message:\n" + message, "utf8")).digest())).toString("base64");

describe("Stellar sign-in", () => {
  const kp = Keypair.random();

  it("accepts a SEP-53 signature over the message, and a bare one", () => {
    expect(verifyStellarMessage(kp.publicKey(), "hello", sep53(kp, "hello"))).toBe(true);
    expect(verifyStellarMessage(kp.publicKey(), "hello", Buffer.from(kp.sign(Buffer.from("hello"))).toString("hex"))).toBe(true);
  });

  it("refuses another key, another message and junk", () => {
    expect(verifyStellarMessage(Keypair.random().publicKey(), "hello", sep53(kp, "hello"))).toBe(false);
    expect(verifyStellarMessage(kp.publicKey(), "hellO", sep53(kp, "hello"))).toBe(false);
    expect(verifyStellarMessage(kp.publicKey(), "hello", "nope")).toBe(false);
  });

  it("signs in with a fresh challenge and gives a stellar: owner ID", () => {
    process.env.BURSAR_SESSION_SECRET ??= "test-secret-test-secret-test-secret-1234";
    const { nonce, token } = newChallenge();
    const id = verifyStellarSignIn({ token, address: kp.publicKey(), signature: sep53(kp, stellarSignInMessage(nonce)) });
    expect(id).toBe(`stellar:${kp.publicKey()}`);
    expect(() => verifyStellarSignIn({ token, address: kp.publicKey(), signature: sep53(kp, "other") })).toThrow(/Signature/);
  });
});

describe("Albedo sign-in", () => {
  it("accepts Albedo's wrapping of Bursr's text, and nothing else", async () => {
    const { verifyAlbedoMessage } = await import("./stellar-signin");
    const kp = Keypair.random();
    const wrapped = Buffer.from(`${kp.publicKey()}:hello`, "utf8");
    const sig = Buffer.from(kp.sign(wrapped)).toString("hex");
    expect(verifyAlbedoMessage(kp.publicKey(), "hello", wrapped.toString("hex"), sig)).toBe(true);
    const other = Buffer.from(`${kp.publicKey()}:bye`, "utf8");
    expect(verifyAlbedoMessage(kp.publicKey(), "hello", other.toString("hex"), Buffer.from(kp.sign(other)).toString("hex"))).toBe(false);
  });
});
