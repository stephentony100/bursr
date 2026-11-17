import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { checkChallenge, issueSessionCookie, SESSION_COOKIE, SIGN_IN_MESSAGE, signInRecipient } from "@/lib/owner";
import { SuiSignInError, verifySuiSignIn } from "@/lib/sui-signin";
import { friendlyError } from "@/lib/errors";

// Live mode sign-in, step 2: verify the wallet's signature.
// - NEAR (the default): a NEP-413 signature; near-api-js checks it and that the
//   key is a FullAccess key of the account.
// - Sui: a personal message over Bursr's own sign-in text (lib/sui-signin.ts).

const SuiBody = z.object({
  chain: z.literal("sui"),
  token: z.string(),
  address: z.string().max(80),
  signature: z.string().max(10_000),
});

const Body = z.object({
  chain: z.literal("near").optional(),
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
  const raw = await req.json();
  if (raw && typeof raw === "object" && (raw as { chain?: unknown }).chain === "sui") return suiSignIn(raw);
  const parsed = Body.safeParse(raw);
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

  return signedIn(accountId, publicKey);
}

async function suiSignIn(raw: unknown) {
  const parsed = SuiBody.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Bad sign-in request." }, { status: 400 });
  try {
    return signedIn(await verifySuiSignIn(parsed.data), "");
  } catch (e) {
    if (!(e instanceof SuiSignInError)) console.error("[bursar] Sui sign-in check failed", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 401 });
  }
}

// Any wallet may sign in: it sees only the business it owns (lib/tenant.ts), or sets one up.
function signedIn(accountId: string, publicKey: string) {
  const res = NextResponse.json({ accountId });
  res.cookies.set(SESSION_COOKIE, issueSessionCookie(accountId, publicKey), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 60 * 60 });
  return res;
}
