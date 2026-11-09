import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readEnv } from "./env";

// Who is the owner? Only code holding an OwnerSession can change rules or
// payees (lib/owner-actions.ts). The session can only be made here:
//   - dry-run: the demo owner, no wallet needed;
//   - live: after the owner signs a NEP-413 sign-in message with a full-access
//     key of their NEAR account (verified in app/api/auth/verify).
// Agent-side code never imports this module (enforced by lib/boundaries.test.ts).

const OWNER = Symbol("bursar.owner");

export interface OwnerSession {
  readonly [OWNER]: true;
  readonly accountId: string;
  /** The full-access public key the owner signed in with (needed as the Agent API owner key). */
  readonly publicKey: string | null;
  readonly demo: boolean;
}

export const DEMO_OWNER_ID = "demo-owner.near";

export function demoOwner(): OwnerSession {
  if (readEnv().BURSAR_MODE !== "dry-run") throw new Error("The demo owner exists only in dry-run mode.");
  return { [OWNER]: true, accountId: DEMO_OWNER_ID, publicKey: null, demo: true };
}

/**
 * The owner acting from their linked Telegram chat. Only lib/telegram.ts calls
 * this, after checking the chat is the one the owner linked with a one-time
 * code from their signed-in web session.
 */
export function telegramOwnerSession(accountId: string): OwnerSession {
  return { [OWNER]: true, accountId, publicKey: null, demo: accountId === DEMO_OWNER_ID };
}

export function isOwnerSession(x: unknown): x is OwnerSession {
  return typeof x === "object" && x !== null && (x as Record<symbol, unknown>)[OWNER] === true;
}

// --- signed session cookie (live mode) ---------------------------------------

export const SESSION_COOKIE = "bursar_owner";
const SESSION_MS = 12 * 60 * 60 * 1000;

let processSecret: Buffer | null = null;
function secret(): Buffer {
  const fromEnv = readEnv().BURSAR_SESSION_SECRET;
  if (fromEnv) return Buffer.from(fromEnv, "utf8");
  // No secret configured: sessions last until the server restarts.
  processSecret ??= randomBytes(32);
  return processSecret;
}

function mac(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

/** Signs a small server-made payload (the agent's action cards), so the browser can hand it back but not alter it. */
export function sealPayload(payload: object, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ p: payload, e: now + ttlMs, t: "card" })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function openPayload<T>(token: string, now = Date.now()): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const { p, e, t } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { p: T; e: number; t?: string };
  if (t !== "card" || typeof e !== "number" || now > e) return null;
  return p;
}

/** Called only after the NEP-413 signature has been verified. */
export function issueSessionCookie(accountId: string, publicKey: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ a: accountId, k: publicKey, e: now + SESSION_MS })).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function sessionFromCookie(value: string | undefined, now = Date.now()): OwnerSession | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const { a, k, e } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { a: string; k: string; e: number };
  // Only session payloads: an action card (signed with the same key) has no account and is refused here.
  if (typeof e !== "number" || now > e || typeof a !== "string" || !a || typeof k !== "string") return null;
  return { [OWNER]: true, accountId: a, publicKey: k, demo: false };
}

// --- sign-in challenge -------------------------------------------------------

export const SIGN_IN_MESSAGE = "Sign in to Bursar as the owner of this business";

export function signInRecipient(): string {
  return new URL(readEnv().NEXT_PUBLIC_APP_URL).host;
}

/** A 32-byte nonce bound to an expiry and MACed, so the server keeps no state. */
export function newChallenge(now = Date.now()): { nonce: string; token: string } {
  const nonce = randomBytes(32).toString("base64");
  const body = `${nonce}|${now + 5 * 60 * 1000}`;
  return { nonce, token: `${Buffer.from(body).toString("base64url")}.${mac(body)}` };
}

export function checkChallenge(token: string, now = Date.now()): string | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const body = Buffer.from(b64, "base64url").toString("utf8");
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [nonce, exp] = body.split("|");
  return Number(exp) >= now ? nonce : null;
}
