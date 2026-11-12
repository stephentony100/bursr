import { createHash } from "node:crypto";
import { readEnv } from "./env";
import type { PrismaClient } from "./generated/prisma/client";

// Many businesses, one Bursr. Every business-owned row carries a
// businessId, and code works through a database client that is limited to one
// business: it adds the business to every read, update and delete, and stamps
// it on every create. A page or the agent can only ever see its own business.
//
// - Business and AgentAccount: one row each per business, with id = businessId.
// - Setting: keys are kept per business ("<businessId>:key"); the first
//   business ("main", from before many businesses) keeps its plain keys.

const SCOPED = new Set(["Payee", "Invoice", "Plan", "PlanItem", "AccountAction", "AuditEvent", "TelegramMessage", "PayeeInvite", "ChatMessage"]);
const BY_ID = new Set(["Business", "AgentAccount"]);
/** Settings shared by every business (the Telegram bot's own name). */
const GLOBAL_SETTINGS = new Set(["telegram_bot_username"]);

const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
const WRITES_WHERE = new Set(["update", "updateMany", "updateManyAndReturn", "delete", "deleteMany"]);

/** The business id for a wallet that has no business yet: stable, so a second setup attempt lands on the same id. */
export function businessIdFor(accountId: string): string {
  return `b_${createHash("sha256").update(accountId).digest("hex").slice(0, 20)}`;
}

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: Record<string, unknown> };

function stampItems(data: Record<string, unknown>, businessId: string) {
  // Nested creates (a plan with its items) bypass the extension, so stamp them here.
  const items = data.items as { create?: unknown } | undefined;
  if (items?.create) {
    const list = Array.isArray(items.create) ? items.create : [items.create];
    for (const it of list as Record<string, unknown>[]) it.businessId = businessId;
  }
}

function settingKey(key: unknown, businessId: string): unknown {
  if (businessId === "main") return key;
  const one = (k: string) => (GLOBAL_SETTINGS.has(k) || k.startsWith(`${businessId}:`) ? k : `${businessId}:${k}`);
  if (typeof key === "string") return one(key);
  if (key && typeof key === "object" && Array.isArray((key as { in?: unknown }).in)) return { ...(key as object), in: (key as { in: string[] }).in.map(one) };
  return key;
}

/** A client limited to one business. */
export function scoped(db: PrismaClient, businessId: string): PrismaClient {
  const ext = db.$extends({
    name: `business:${businessId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const a = (args ?? {}) as Args;
          if (SCOPED.has(model)) {
            if (READS.has(operation) || WRITES_WHERE.has(operation)) a.where = { ...(a.where ?? {}), businessId };
            if (operation === "create") {
              a.data = { ...(a.data as object), businessId };
              stampItems(a.data as Record<string, unknown>, businessId);
            }
            if (operation === "createMany" || operation === "createManyAndReturn") {
              const list = Array.isArray(a.data) ? a.data : [a.data];
              a.data = (list as object[]).map((d) => ({ ...d, businessId }));
            }
            if (operation === "upsert") {
              a.where = { ...(a.where ?? {}), businessId };
              a.create = { ...(a.create ?? {}), businessId };
            }
          } else if (BY_ID.has(model)) {
            if (READS.has(operation) || WRITES_WHERE.has(operation)) a.where = { ...(a.where ?? {}), id: businessId };
            if (operation === "create") a.data = { ...(a.data as object), id: businessId };
            if (operation === "upsert") {
              a.where = { ...(a.where ?? {}), id: businessId };
              a.create = { ...(a.create ?? {}), id: businessId };
            }
          } else if (model === "Setting") {
            if (a.where && "key" in a.where) a.where = { ...a.where, key: settingKey(a.where.key, businessId) };
            if (a.data && typeof a.data === "object" && "key" in (a.data as object)) a.data = { ...(a.data as object), key: settingKey((a.data as { key: unknown }).key, businessId) };
            if (a.create && "key" in a.create) a.create = { ...a.create, key: settingKey(a.create.key, businessId) };
            if ((READS.has(operation) || operation === "deleteMany") && !(a.where && "key" in a.where) && businessId !== "main") {
              a.where = { ...(a.where ?? {}), key: { startsWith: `${businessId}:` } };
            }
          }
          return query(a);
        },
      },
    },
  });
  return ext as unknown as PrismaClient;
}

/** The business a wallet owns: its existing one, or the id a new one will get. */
export async function businessIdOf(db: PrismaClient, accountId: string): Promise<string> {
  const existing = await db.business.findFirst({ where: { ownerAccountId: accountId }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return existing?.id ?? businessIdFor(accountId);
}

/** A client limited to the business this wallet owns (or will own once set up). */
export async function dbForOwner(db: PrismaClient, accountId: string): Promise<PrismaClient> {
  return scoped(db, await businessIdOf(db, accountId));
}

/** Every business, for the agent loop and the Telegram bot. */
export async function allBusinessIds(db: PrismaClient): Promise<string[]> {
  return (await db.business.findMany({ select: { id: true }, orderBy: { createdAt: "asc" } })).map((b) => b.id);
}

/**
 * For the terminal scripts (fund, live-preview, rules-live…): the business to
 * work on. With one business it's that one; with several, BURSAR_OWNER names
 * the owner's NEAR account.
 */
export async function scriptDb(raw: PrismaClient): Promise<PrismaClient> {
  const owner = readEnv().BURSAR_OWNER;
  if (owner) return dbForOwner(raw, owner);
  const ids = await allBusinessIds(raw);
  if (ids.length <= 1) return scoped(raw, ids[0] ?? "main");
  throw new Error(`This Bursr has ${ids.length} businesses. Say which one with BURSAR_OWNER=<the owner's NEAR account>, for example: BURSAR_OWNER=you.near npm run fund -- USDC near`);
}
