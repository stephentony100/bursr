import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { readEnv } from "./env";
import { PrismaClient } from "./generated/prisma/client";

// One client per process (Next.js dev reloads modules; keep it on globalThis).
const g = globalThis as unknown as { bursarDb?: PrismaClient };

export function db(): PrismaClient {
  g.bursarDb ??= new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: readEnv().DATABASE_URL }) });
  return g.bursarDb;
}
