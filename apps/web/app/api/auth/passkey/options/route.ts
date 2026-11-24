import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/errors";
import { isStellarEdition } from "@/lib/stellar-owner";
import { kitSettings, signInOptions, signUpOptions, STELLAR_PASSKEY_COOKIE } from "@/lib/stellar-passkey";

// Stellar edition, passkey step 1: Bursr's challenge for creating a passkey
// (sign-up) or using one (sign-in), plus the public settings the browser's
// Smart Account Kit needs. The challenge is sealed in a short-lived cookie.

export async function GET(req: Request) {
  if (!isStellarEdition()) return NextResponse.json({ error: "Passkey sign-in is part of Bursr on Stellar." }, { status: 404 });
  const url = new URL(req.url);
  const purpose = url.searchParams.get("for") === "signup" ? "signup" : "signin";
  try {
    const { options, sealed } = purpose === "signup" ? await signUpOptions((url.searchParams.get("name") ?? "").slice(0, 60) || "My business") : await signInOptions();
    const res = NextResponse.json({ options, kit: kitSettings() });
    res.cookies.set(STELLAR_PASSKEY_COOKIE, sealed, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/auth/passkey", maxAge: 5 * 60 });
    return res;
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 400 });
  }
}
