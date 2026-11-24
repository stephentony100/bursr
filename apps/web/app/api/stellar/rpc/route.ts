import { NextResponse } from "next/server";
import { z } from "zod";
import { isStellarEdition } from "@/lib/stellar-owner";
import { stellarConfig } from "@/lib/stellar";

// Read-only Stellar RPC for the browser's Smart Account Kit (it reads the
// passkey account's code and signers, and simulates). Bursr's own RPC URL
// (which may carry a provider key) stays on the server, and nothing can be
// sent from here: every transaction goes through Bursr's own routes.

const READ_METHODS = new Set(["getHealth", "getNetwork", "getLatestLedger", "getLedgerEntries", "getVersionInfo", "getFeeStats", "simulateTransaction", "getTransaction", "getEvents"]);
const Body = z.object({ jsonrpc: z.literal("2.0"), id: z.union([z.string(), z.number()]), method: z.string(), params: z.unknown().optional() });

export async function POST(req: Request) {
  if (!isStellarEdition()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const text = await req.text();
  if (text.length > 200_000) return NextResponse.json({ error: "Too large." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const body = Body.safeParse(json);
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (!READ_METHODS.has(body.data.method)) {
    return NextResponse.json({ jsonrpc: "2.0", id: body.data.id, error: { code: -32601, message: "Only reads go through Bursr's Stellar RPC." } });
  }
  const res = await fetch(stellarConfig().rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: text, signal: AbortSignal.timeout(20_000) });
  return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
}
