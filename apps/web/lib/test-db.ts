import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

/** A fresh SQLite database with the current schema, for one test file. */
export function createTestDb(): { db: PrismaClient; reset: () => Promise<void>; close: () => Promise<void> } {
  const dir = mkdtempSync(path.join(tmpdir(), "bursar-test-"));
  const url = `file:${path.join(dir, "test.db")}`;
  execSync("npx prisma db push", { env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" }, stdio: "pipe" });
  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  return {
    db,
    reset: async () => {
      await db.$transaction([
        db.telegramMessage.deleteMany(),
        db.setting.deleteMany(),
        db.planItem.deleteMany(),
        db.plan.deleteMany(),
        db.invoice.deleteMany(),
        db.accountAction.deleteMany(),
        db.auditEvent.deleteMany(),
        db.payeeInvite.deleteMany(),
        db.payee.deleteMany(),
        db.agentAccount.deleteMany(),
        db.business.deleteMany(),
      ]);
    },
    close: async () => {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
