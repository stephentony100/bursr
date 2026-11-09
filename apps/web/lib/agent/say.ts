import type { PrismaClient } from "../generated/prisma/client";

// The agent's voice: every step it takes is written to the activity log in
// plain words (the owner's feed on This week and the Agent page).

export async function say(db: PrismaClient, kind: string, message: string, data?: Record<string, unknown>) {
  await db.auditEvent.create({ data: { kind, actor: "agent", message, data: data ? JSON.stringify(data) : null } });
}

/** Says something at most once per `key` within `ttlMs` (so a waiting payment isn't announced every minute). */
export async function sayOnce(db: PrismaClient, key: string, ttlMs: number, kind: string, message: string, data?: Record<string, unknown>) {
  const k = `said:${key}`;
  const row = await db.setting.findUnique({ where: { key: k } });
  if (row && Date.now() - Date.parse(row.value) < ttlMs) return false;
  await db.setting.upsert({ where: { key: k }, update: { value: new Date().toISOString() }, create: { key: k, value: new Date().toISOString() } });
  await say(db, kind, message, data);
  return true;
}
