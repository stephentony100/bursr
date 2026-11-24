import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { friendlyError } from "@/lib/errors";
import { issueSessionCookie, SESSION_COOKIE } from "@/lib/owner";
import { isStellarEdition } from "@/lib/stellar-owner";
import { completeSignUp, SignUpBody, STELLAR_PASSKEY_COOKIE, StellarPasskeyError } from "@/lib/stellar-passkey";

// Stellar edition, passkey sign-up: checks the new passkey and its passkey
// account (lib/stellar-passkey.ts), sends the account's deploy with Bursr's
// fee account, and signs the owner in. No wallet needed.

export async function POST(req: Request) {
  if (!isStellarEdition()) return NextResponse.json({ error: "Passkey sign-up is part of Bursr on Stellar." }, { status: 404 });
  const body = SignUpBody.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad sign-up request." }, { status: 400 });
  const jar = await cookies();
  try {
    const ownerId = await completeSignUp(db(), body.data, jar.get(STELLAR_PASSKEY_COOKIE)?.value);
    const res = NextResponse.json({ accountId: ownerId });
    res.cookies.delete({ name: STELLAR_PASSKEY_COOKIE, path: "/api/auth/passkey" });
    res.cookies.set(SESSION_COOKIE, issueSessionCookie(ownerId, ""), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 60 * 60 });
    return res;
  } catch (e) {
    if (!(e instanceof StellarPasskeyError)) console.error("[bursar] passkey sign-up failed", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 400 });
  }
}
