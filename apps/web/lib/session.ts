import { cookies } from "next/headers";
import { readEnv } from "./env";
import { demoOwner, sessionFromCookie, SESSION_COOKIE, type OwnerSession } from "./owner";

/** The owner for this request: the demo owner in dry-run, the signed-in wallet in live mode. */
export async function getOwner(): Promise<OwnerSession | null> {
  if (readEnv().BURSAR_MODE === "dry-run") return demoOwner();
  return sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getOwner();
  if (!owner) throw new Error("Sign in with your NEAR wallet first (button at the top right).");
  return owner;
}
