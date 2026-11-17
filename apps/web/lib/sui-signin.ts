import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { isValidSuiAddress, normalizeSuiAddress } from "@mysten/sui/utils";
import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { checkChallenge, SIGN_IN_MESSAGE, signInRecipient } from "./owner";

// Live mode sign-in with a Sui wallet. The wallet signs a personal message that
// Bursr wrote (sign-in sentence, this site, a one-time nonce); the server
// rebuilds that message itself and checks the signature against the claimed
// address. The browser's copy of the message is never trusted.

export const SUI_MAINNET_GRAPHQL = "https://graphql.mainnet.sui.io/graphql";

/** The exact text the Sui wallet shows and signs. */
export function suiSignInMessage(nonce: string, host = signInRecipient()): string {
  return `${SIGN_IN_MESSAGE}\n\nSite: ${host}\nNonce: ${nonce}`;
}

/** Bursr's owner ID for a Sui address: `sui:` + 0x and 64 lowercase hex characters. */
export function suiOwnerId(address: string): string {
  return `sui:${normalizeSuiAddress(address)}`;
}

export class SuiSignInError extends Error {}

/**
 * Checks a Sui wallet's signature over the sign-in message for this challenge.
 * zkLogin wallets (Google/Apple sign-in) are checked through Sui's GraphQL API,
 * as the SDK docs require. Returns the owner ID.
 */
export async function verifySuiSignIn(
  input: { token: string; address: string; signature: string },
  opts: { client?: SuiGraphQLClient; now?: number } = {},
): Promise<string> {
  const nonce = checkChallenge(input.token, opts.now);
  if (!nonce) throw new SuiSignInError("The sign-in request expired. Try again.");
  if (!isValidSuiAddress(input.address)) throw new SuiSignInError("That isn't a Sui wallet address.");
  const address = normalizeSuiAddress(input.address);
  const message = new TextEncoder().encode(suiSignInMessage(nonce));
  try {
    await verifyPersonalMessageSignature(message, input.signature, {
      address,
      client: opts.client ?? new SuiGraphQLClient({ url: SUI_MAINNET_GRAPHQL, network: "mainnet" }),
    });
  } catch {
    throw new SuiSignInError("Signature not accepted");
  }
  return suiOwnerId(address);
}
