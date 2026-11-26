import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/errors";
import { finishPracticeNairaIn, rampOrderView, startNairaIn, startNairaOut, verifyForNaira } from "@/lib/ramp-orders";
import { isStellarEdition } from "@/lib/stellar-owner";
import { appDb, getOwner } from "@/lib/session";

// Naira in and out (lib/ramp-orders.ts). Cash-out is confirmed through
// /api/owner/intent (kind "cash_out"), where the owner's passkey signs.

const Usd = z.string().regex(/^\d{1,9}$/); // micro-dollars
const Body = z.discriminatedUnion("step", [
  z.object({ step: z.literal("in_start"), usd: Usd }),
  z.object({ step: z.literal("in_paid"), orderId: z.string().min(1).max(64) }),
  z.object({ step: z.literal("in_status"), orderId: z.string().min(1).max(64) }),
  // Linq naira in: the business's person, verified once. The NIN is passed to Linq and not kept.
  z.object({ step: z.literal("verify"), firstName: z.string().max(60), lastName: z.string().max(60), email: z.string().max(120), phone: z.string().max(20), nin: z.string().max(20) }),
  z.object({ step: z.literal("out_start"), usd: Usd, bankCode: z.string().regex(/^\d{3,6}$/), accountNumber: z.string().max(20) }),
]);

export async function POST(req: Request) {
  if (!isStellarEdition()) return NextResponse.json({ error: "Naira in and out is part of Bursr on Stellar." }, { status: 404 });
  const owner = await getOwner();
  if (!owner || owner.demo) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const db = await appDb();
  try {
    const b = body.data;
    if (b.step === "in_start") return NextResponse.json(await startNairaIn(db, owner, BigInt(b.usd)));
    if (b.step === "in_paid") return NextResponse.json(await finishPracticeNairaIn(db, owner, b.orderId));
    if (b.step === "in_status") return NextResponse.json(await rampOrderView(db, b.orderId));
    if (b.step === "verify") return NextResponse.json(await verifyForNaira(db, owner, b));
    return NextResponse.json(await startNairaOut(db, owner, BigInt(b.usd), b.bankCode, b.accountNumber.trim()));
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e, "That didn't go through, so nothing changed. Please try again.") }, { status: 400 });
  }
}
