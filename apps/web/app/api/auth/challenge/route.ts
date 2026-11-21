import { NextResponse } from "next/server";
import { newChallenge, SIGN_IN_MESSAGE, signInRecipient } from "@/lib/owner";
import { suiSignInMessage } from "@/lib/sui-signin";
import { stellarSignInMessage } from "@/lib/stellar-signin";

// Live mode sign-in, step 1: a fresh challenge for the wallet to sign. NEAR
// wallets sign it as NEP-413 (message, recipient, nonce); Sui wallets sign
// `suiMessage`, the same sentence with this site and the nonce written out;
// Stellar wallets sign `stellarMessage` (the same text) as a SEP-53 message.
export async function GET() {
  const { nonce, token } = newChallenge();
  return NextResponse.json({ message: SIGN_IN_MESSAGE, recipient: signInRecipient(), nonce, token, suiMessage: suiSignInMessage(nonce), stellarMessage: stellarSignInMessage(nonce) });
}
