import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { setupBusiness } from "@/lib/owner-actions";
import { getOwner } from "@/lib/session";
import { starterRules } from "@/lib/starter-rules";
import { payoutTokens } from "@/lib/tokens";
import { friendlyError } from "@/lib/errors";

// Live mode: the signed-in owner creates their business with tiny starter caps.
export async function POST(req: Request) {
  const owner = await getOwner();
  if (!owner || owner.demo) return NextResponse.json({ error: "Sign in with your NEAR wallet first." }, { status: 401 });
  const body = z.object({ name: z.string().trim().min(2).max(80) }).safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: "Enter your business name." }, { status: 400 });
  try {
    await setupBusiness(db(), owner, { name: body.data.name, rules: starterRules(await payoutTokens()) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e, "Could not set up.") }, { status: 400 });
  }
}
