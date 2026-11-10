import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import type { PrismaClient } from "./generated/prisma/client";
import { getBusiness } from "./store";
import { readEnv } from "./env";
import { demoOwner, sessionFromCookie, SESSION_COOKIE, type OwnerSession } from "./owner";
import { dbForOwner, scoped } from "./tenant";

/** The owner for this request: the demo owner in dry-run, the signed-in wallet in live mode. */
export async function getOwner(): Promise<OwnerSession | null> {
  if (readEnv().BURSAR_MODE === "dry-run") return demoOwner();
  return sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getOwner();
  if (!owner) throw new Error("Sign in with your NEAR wallet first.");
  return owner;
}

/**
 * The database as this request may see it: only the signed-in wallet's own
 * business (lib/tenant.ts). Signed out, it sees no business at all.
 */
export const appDb = cache(async (): Promise<PrismaClient> => {
  const owner = await getOwner();
  if (!owner) return scoped(db(), "signed-out");
  return dbForOwner(db(), owner.accountId);
});

/**
 * Live mode: every app page calls this first. Signed out → sign in; a wallet
 * with no business yet → setup. (A layout check alone is not enough: Next.js
 * renders a page alongside its layout.)
 */
export async function guardPage(): Promise<void> {
  if (readEnv().BURSAR_MODE === "dry-run") return;
  const owner = await getOwner();
  if (!owner) redirect("/signin");
  if (!(await getBusiness(await appDb()))) redirect("/welcome");
}
