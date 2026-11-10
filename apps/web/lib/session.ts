import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getBusiness } from "./store";
import { readEnv } from "./env";
import { demoOwner, sessionFromCookie, SESSION_COOKIE, type OwnerSession } from "./owner";

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
 * Live mode: every app page calls this first. Nothing about the business is
 * rendered unless its owner's wallet is signed in (a layout check alone is not
 * enough: Next.js renders a page alongside its layout).
 */
export async function guardPage(): Promise<void> {
  if (readEnv().BURSAR_MODE === "dry-run") return;
  const business = await getBusiness(db());
  if (!business) redirect("/welcome");
  const owner = await getOwner();
  if (!owner || owner.accountId !== business.ownerAccountId) redirect("/signin");
}
