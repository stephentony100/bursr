import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { friendlyError } from "@/lib/errors";
import { issueSessionCookie, SESSION_COOKIE } from "@/lib/owner";
import { isStellarEdition } from "@/lib/stellar-owner";
import { completeSignIn, STELLAR_PASSKEY_COOKIE, StellarPasskeyError } from "@/lib/stellar-passkey";

// Stellar edition, passkey sign-in: the passkey answers Bursr's challenge and
// is checked against the public key saved at sign-up.

const Body = z.object({ response: z.custom<AuthenticationResponseJSON>((v) => typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string") });

export async function POST(req: Request) {
  if (!isStellarEdition()) return NextResponse.json({ error: "Passkey sign-in is part of Bursr on Stellar." }, { status: 404 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad sign-in request." }, { status: 400 });
  const jar = await cookies();
  try {
    const ownerId = await completeSignIn(db(), body.data.response, jar.get(STELLAR_PASSKEY_COOKIE)?.value);
    const res = NextResponse.json({ accountId: ownerId });
    res.cookies.delete({ name: STELLAR_PASSKEY_COOKIE, path: "/api/auth/passkey" });
    res.cookies.set(SESSION_COOKIE, issueSessionCookie(ownerId, ""), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 60 * 60 });
    return res;
  } catch (e) {
    if (!(e instanceof StellarPasskeyError)) console.error("[bursar] passkey sign-in failed", e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 401 });
  }
}
