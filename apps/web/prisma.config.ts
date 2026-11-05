import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The one .env lives at the repo root; dry-run works without it.
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./dev.db" },
});
