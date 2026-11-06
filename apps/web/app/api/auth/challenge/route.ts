import { NextResponse } from "next/server";
import { newChallenge, SIGN_IN_MESSAGE, signInRecipient } from "@/lib/owner";

// Live mode sign-in, step 1: a fresh NEP-413 challenge for the wallet to sign.
export async function GET() {
  const { nonce, token } = newChallenge();
  return NextResponse.json({ message: SIGN_IN_MESSAGE, recipient: signInRecipient(), nonce, token });
}
