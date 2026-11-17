import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PASSKEY_CHALLENGE_COOKIE, registrationOptions, verifyRegistration } from "@/lib/passkey";
import { getOwner, appDb } from "@/lib/session";
import { friendlyError } from "@/lib/errors";

// Live mode: the signed-in owner creates the passkey that will own their agent's
// wallet. Step "options" starts the browser's passkey prompt; step "verify"
// checks its answer and saves the passkey's public parts.

const Body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("options") }),
  // The browser's RegistrationResponseJSON; @simplewebauthn/server checks every field.
  z.object({ step: z.literal("verify"), response: z.object({ id: z.string(), rawId: z.string(), type: z.literal("public-key"), response: z.record(z.string(), z.unknown()) }).passthrough() }),
]);

export async function POST(req: Request) {
  const owner = await getOwner();
  if (!owner || owner.demo) return NextResponse.json({ error: "Sign in with your wallet first." }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    if (body.data.step === "options") {
      const { options, sealedChallenge } = await registrationOptions(await appDb(), owner);
      const res = NextResponse.json(options);
      res.cookies.set(PASSKEY_CHALLENGE_COOKIE, sealedChallenge, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/api/owner/passkey", maxAge: 5 * 60 });
      return res;
    }
    const sealed = (await cookies()).get(PASSKEY_CHALLENGE_COOKIE)?.value;
    const passkey = await verifyRegistration(await appDb(), owner, body.data.response as never, sealed);
    const res = NextResponse.json({ ok: true, backedUp: passkey.backedUp });
    res.cookies.delete({ name: PASSKEY_CHALLENGE_COOKIE, path: "/api/owner/passkey" });
    return res;
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e, "Your passkey wasn't saved. Please try again.") }, { status: 400 });
  }
}
