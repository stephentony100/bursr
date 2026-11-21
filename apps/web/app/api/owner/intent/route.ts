import { NextResponse } from "next/server";
import { z } from "zod";
import { prepareOwnerIntent, submitOwnerIntent } from "@/lib/owner-intents";
import { isStellarEdition, prepareStellarOwnerTx, submitStellarOwnerTx } from "@/lib/stellar-owner";
import { getOwner, appDb } from "@/lib/session";
import { friendlyError } from "@/lib/errors";

// Live mode owner actions: prepare an intent for the wallet, then submit the
// wallet's signature. The owner session is checked on both steps.
// Stellar edition: the same two steps, with a Stellar transaction to sign
// (lib/stellar-owner.ts), plus adding money and moving it back.

const Kind = z.enum(["agent_create", "policy_update", "agent_freeze", "agent_unfreeze", "grant_issue"]);
const Body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("prepare"), kind: Kind }),
  z.object({
    step: z.literal("submit"),
    kind: Kind,
    correlationId: z.string().min(1),
    agentId: z.string().min(1),
    signedData: z.record(z.string(), z.unknown()),
  }),
]);

const StellarBody = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("prepare"),
    kind: z.enum(["agent_create", "policy_update", "agent_freeze", "agent_unfreeze", "fund", "withdraw", "test_usdc"]),
    /** fund / withdraw: USDC in its smallest units (7 decimals), as a string. */
    amount: z.string().regex(/^\d{1,20}$/).optional(),
  }),
  z.object({ step: z.literal("submit"), correlationId: z.string().regex(/^[0-9a-f]{64}$/), signedData: z.object({ signedXdr: z.string().min(1).max(100_000) }) }),
]);

export async function POST(req: Request) {
  const owner = await getOwner();
  if (!owner || owner.demo) return NextResponse.json({ error: "Sign in with your wallet first." }, { status: 401 });
  const raw = await req.json();
  try {
    if (isStellarEdition()) {
      const body = StellarBody.safeParse(raw);
      if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
      if (body.data.step === "prepare") {
        const { kind, amount } = body.data;
        return NextResponse.json(await prepareStellarOwnerTx(await appDb(), owner, kind, { amount: amount ? BigInt(amount) : undefined }));
      }
      return NextResponse.json(await submitStellarOwnerTx(await appDb(), owner, { correlationId: body.data.correlationId, signedXdr: body.data.signedData.signedXdr }));
    }
    const body = Body.safeParse(raw);
    if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
    if (body.data.step === "prepare") return NextResponse.json(await prepareOwnerIntent((await appDb()), owner, body.data.kind));
    const { kind, correlationId, agentId, signedData } = body.data;
    return NextResponse.json(await submitOwnerIntent((await appDb()), owner, { kind, correlationId, agentId, signedData: signedData as never }));
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e, "That didn't go through, so nothing changed. Please try again.") }, { status: 400 });
  }
}
