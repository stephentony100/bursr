import { NextResponse } from "next/server";
import { z } from "zod";
import { prepareOwnerIntent, submitOwnerIntent } from "@/lib/owner-intents";
import { getOwner, appDb } from "@/lib/session";
import { friendlyError } from "@/lib/errors";

// Live mode owner actions: prepare an intent for the wallet, then submit the
// wallet's signature. The owner session is checked on both steps.

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

export async function POST(req: Request) {
  const owner = await getOwner();
  if (!owner || owner.demo) return NextResponse.json({ error: "Sign in with your NEAR wallet first." }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  try {
    if (body.data.step === "prepare") return NextResponse.json(await prepareOwnerIntent((await appDb()), owner, body.data.kind));
    const { kind, correlationId, agentId, signedData } = body.data;
    return NextResponse.json(await submitOwnerIntent((await appDb()), owner, { kind, correlationId, agentId, signedData: signedData as never }));
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e, "That didn't go through, so nothing changed. Please try again.") }, { status: 400 });
  }
}
