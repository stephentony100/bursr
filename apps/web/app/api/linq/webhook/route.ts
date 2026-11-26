import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { verifyLinqSignature } from "@/lib/linq";
import { applyLinqOnrampUpdate, applyLinqUpdate, returnRefunds } from "@/lib/ramp-orders";

// Linq's webhooks for cash-out and naira-in orders (order.processing,
// order.completed, order.failed). Signed with HMAC-SHA256 over the raw body in
// X-Linq-Signature, with the webhook secret; anything else is refused.
// Linq tries each event once, so the Wallet page also checks status
// (refreshLinqOrders). Register https://<this site>/api/linq/webhook with Linq.

const Event = z.object({ event: z.string(), orderId: z.string().min(1), status: z.string().default("") });

export async function POST(req: Request) {
  const secret = readEnv().LINQ_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not set up." }, { status: 404 });
  const raw = await req.text();
  if (!verifyLinqSignature(raw, req.headers.get("x-linq-signature"), secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let parsed: z.infer<typeof Event>;
  try {
    parsed = Event.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Bad event" }, { status: 400 });
  }
  try {
    // The same events cover cash-outs and naira in; each handler ignores the other kind.
    await applyLinqUpdate(db(), parsed.orderId, parsed.status, parsed.event);
    await applyLinqOnrampUpdate(db(), parsed.orderId, parsed.status, parsed.event);
    if (parsed.event === "order.failed") await returnRefunds(db()).catch((e) => console.error("[bursar] Linq refund", e));
  } catch (e) {
    console.error("[bursar] Linq webhook", e);
    return NextResponse.json({ error: "Not processed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
