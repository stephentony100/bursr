import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isStellarEdition } from "@/lib/stellar-owner";
import { kitLookup } from "@/lib/stellar-passkey";

// Smart Account Kit's indexer lookup (`GET <indexerUrl>/api/lookup/<credential id, hex>`),
// answered by Bursr for the passkey accounts it sent. Public facts only: the
// account's address and its creation transaction, which the kit re-checks on chain.

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isStellarEdition()) return NextResponse.json({ error: "Not available." }, { status: 404 });
  const { id } = await ctx.params;
  if (!/^[0-9a-fA-F]{2,1024}$/.test(id)) return NextResponse.json({ error: "Bad credential id." }, { status: 400 });
  return NextResponse.json(await kitLookup(db(), id));
}
