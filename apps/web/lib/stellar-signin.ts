import { createHash } from "node:crypto";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { checkChallenge } from "./owner";
import { suiSignInMessage } from "./sui-signin";

// Sign-in with a Stellar wallet (Stellar edition). The wallet signs Bursr's
// sign-in text (this site and a one-time nonce) as a SEP-53 message: an ed25519
// signature over SHA-256("Stellar Signed Message:\n" + message). The server
// rebuilds the text itself and checks the signature against the G-address.

const SEP53_PREFIX = "Stellar Signed Message:\n";

/** The exact text the Stellar wallet shows and signs (the same words as the Sui sign-in). */
export const stellarSignInMessage = suiSignInMessage;

export const stellarOwnerId = (address: string) => `stellar:${address}`;

export class StellarSignInError extends Error {}

function signatureBytes(sig: string): Buffer | null {
  const s = sig.trim();
  const b = /^[0-9a-fA-F]{128}$/.test(s) ? Buffer.from(s, "hex") : Buffer.from(s, "base64");
  return b.length === 64 ? b : null;
}

/** Checks a SEP-53 signature by `address` over `message`. Some wallets sign the bare text; that is accepted too. */
export function verifyStellarMessage(address: string, message: string, signature: string): boolean {
  if (!StrKey.isValidEd25519PublicKey(address)) return false;
  const sig = signatureBytes(signature);
  if (!sig) return false;
  const key = Keypair.fromPublicKey(address);
  const hashed = createHash("sha256").update(Buffer.concat([Buffer.from(SEP53_PREFIX, "utf8"), Buffer.from(message, "utf8")])).digest();
  try {
    return key.verify(hashed, sig) || key.verify(Buffer.from(message, "utf8"), sig);
  } catch {
    return false;
  }
}

/**
 * Albedo signs its own wrapping of the text ("signed_message", hex) rather than
 * the text itself. Accepted only when that wrapping starts with the signer's
 * address and ends with Bursr's exact text, and the signature covers it.
 */
export function verifyAlbedoMessage(address: string, message: string, signedMessageHex: string, signature: string): boolean {
  if (!/^[0-9a-fA-F]+$/.test(signedMessageHex) || signedMessageHex.length > 4000) return false;
  const wrapped = Buffer.from(signedMessageHex, "hex");
  const text = wrapped.toString("utf8");
  if (!text.startsWith(address) || !text.endsWith(message)) return false;
  const sig = signatureBytes(signature);
  if (!sig || !StrKey.isValidEd25519PublicKey(address)) return false;
  const key = Keypair.fromPublicKey(address);
  try {
    return key.verify(wrapped, sig) || key.verify(createHash("sha256").update(wrapped).digest(), sig);
  } catch {
    return false;
  }
}

/** Checks the wallet's signature for this challenge and returns the owner ID (`stellar:G…`). */
export function verifyStellarSignIn(input: { token: string; address: string; signature: string; signedMessage?: string }, now?: number): string {
  const nonce = checkChallenge(input.token, now);
  if (!nonce) throw new StellarSignInError("The sign-in request expired. Try again.");
  const address = input.address.trim();
  if (!StrKey.isValidEd25519PublicKey(address)) throw new StellarSignInError("That isn't a Stellar wallet address.");
  const message = stellarSignInMessage(nonce);
  const ok = input.signedMessage ? verifyAlbedoMessage(address, message, input.signedMessage, input.signature) : verifyStellarMessage(address, message, input.signature);
  if (!ok) throw new StellarSignInError("Signature not accepted");
  return stellarOwnerId(address);
}
