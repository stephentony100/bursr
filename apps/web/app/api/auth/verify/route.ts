import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { checkChallenge, issueSessionCookie, SESSION_COOKIE, SIGN_IN_MESSAGE, signInRecipient } from "@/lib/owner";
import { friendlyError } from "@/lib/errors";

// Live mode sign-in, step 2: verify the wallet's NEP-413 signature. near-api-js
// checks the signature and that the key is a FullAccess key of the account,
// which is also what the Agent API requires of an owner.

const Body = z.object({
  token: z.string(),
  accountId: z.string().regex(/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/),
  publicKey: z.string().startsWith("ed25519:"),
  signature: z.string(),
});

function decodeSignature(s: string): Uint8Array {
  const b = Buffer.from(s, "base64");
  if (b.length !== 64) throw new Error("Unexpected signature format");
  return new Uint8Array(b);
}

export async function POST(req: Request) {
  const env = readEnv();
  if (env.BURSAR_MODE === "dry-run") return NextResponse.json({ error: "Practice mode needs no sign-in." }, { status: 400 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Bad sign-in request." }, { status: 400 });
  const { token, accountId, publicKey, signature } = parsed.data;

  const nonce = checkChallenge(token);
  if (!nonce) return NextResponse.json({ error: "The sign-in request expired. Try again." }, { status: 400 });

  try {
    await verifyMessage({
      signerAccountId: accountId,
      signerPublicKey: publicKey,
      signature: decodeSignature(signature),
      payload: { message: SIGN_IN_MESSAGE, recipient: signInRecipient(), nonce: new Uint8Array(Buffer.from(nonce, "base64")) },
      provider: new JsonRpcProvider({ url: env.NEAR_RPC_URL }),
    });
  } catch (e) {
    console.error("[bursar] sign-in signature check failed", e);
    return NextResponse.json({ error: friendlyError(new Error("Signature not accepted")) }, { status: 401 });
  }

  // Any wallet may sign in: it sees only the business it owns (lib/tenant.ts), or sets one up.
  const res = NextResponse.json({ accountId });
  res.cookies.set(SESSION_COOKIE, issueSessionCookie(accountId, publicKey), { httpOnly: true, sameSite: "strict", path: "/", maxAge: 12 * 60 * 60 });
  return res;
}
