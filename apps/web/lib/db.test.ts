import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

const dir = mkdtempSync(path.join(tmpdir(), "bursar-db-"));
const url = `file:${path.join(dir, "test.db")}`;

describe("database", () => {
  const client = (() => {
    execSync("npx prisma db push", {
      env: { ...process.env, DATABASE_URL: url, CHECKPOINT_DISABLE: "1" },
      stdio: "pipe",
    });
    return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  })();

  afterAll(async () => {
    await client.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes and reads an audit event", async () => {
    await client.auditEvent.create({ data: { kind: "test", actor: "owner", message: "hello" } });
    const rows = await client.auditEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe("hello");
  });
}, 120_000);
