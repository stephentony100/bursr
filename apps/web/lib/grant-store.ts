import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readEnv } from "./env";
import type { PrismaClient } from "./generated/prisma/client";

// The agent's grant token (its payment pass) is kept in the database, sealed
// with AES-256-GCM under BURSAR_DATA_KEY, which lives only in .env. The agent
// id is bound in as associated data, so a sealed pass cannot be moved to
// another agent. Losing the key only means the owner issues a new pass.

const VERSION = "v1";
const RENEW_WARNING_MS = 3 * 24 * 60 * 60 * 1000;

export class GrantUnreadableError extends Error {
  constructor() {
    super("Bursr can't read its payment pass (the data key changed or the pass was damaged). Press \"Let Bursr make payments\" again on the Limits page.");
  }
}

/** BURSAR_DATA_KEY: 64 hex characters (32 random bytes). */
export function dataKey(raw = readEnv().BURSAR_DATA_KEY): Buffer {
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("Live mode needs BURSAR_DATA_KEY in .env: 64 hex characters. Make one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  }
  return Buffer.from(raw, "hex");
}

export function sealGrant(token: string, agentId: string, key: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(agentId, "utf8"));
  const body = Buffer.concat([c.update(token, "utf8"), c.final()]);
  return [VERSION, iv, c.getAuthTag(), body].map((x) => (typeof x === "string" ? x : x.toString("base64url"))).join(".");
}

export function openGrant(sealed: string, agentId: string, key: Buffer): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== VERSION || !iv || !tag || !body) throw new GrantUnreadableError();
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    d.setAAD(Buffer.from(agentId, "utf8"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    throw new GrantUnreadableError();
  }
}

export async function saveGrant(db: PrismaClient, agentId: string, token: string, expiresAt: Date, key = dataKey()) {
  await db.agentAccount.update({ where: { id: "main" }, data: { grantSealed: sealGrant(token, agentId, key), grantExpiresAt: expiresAt } });
}

export interface GrantState {
  /** A pass is stored and has not expired. */
  usable: boolean;
  expiresAt: Date | null;
  /** Usable but ends within 3 days: offer to renew. */
  renewSoon: boolean;
}

export function grantState(record: { grantSealed: string | null; grantExpiresAt: Date | null } | null, now = new Date()): GrantState {
  const expiresAt = record?.grantSealed ? record.grantExpiresAt : null;
  const usable = Boolean(record?.grantSealed) && (!expiresAt || expiresAt.getTime() > now.getTime());
  return { usable, expiresAt, renewSoon: usable && Boolean(expiresAt) && expiresAt!.getTime() - now.getTime() < RENEW_WARNING_MS };
}

/** The plain pass for the live agent account; only lib/agent-account.ts and the live scripts call this. */
export function readGrant(record: { agentId: string; grantSealed: string | null; grantExpiresAt: Date | null }, now = new Date(), key = dataKey()): string {
  if (!record.grantSealed) throw new Error("Bursr isn't allowed to make payments yet. On Limits, press \"Let Bursr make payments inside my limits\".");
  if (!grantState(record, now).usable) throw new Error("Bursr's permission to make payments has run out. On Limits, press \"Renew Bursr's permission to pay\".");
  return openGrant(record.grantSealed, record.agentId, key);
}
