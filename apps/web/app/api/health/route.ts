import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Railway's health check: the server is up and the database answers.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db().$queryRawUnsafe("SELECT 1");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
