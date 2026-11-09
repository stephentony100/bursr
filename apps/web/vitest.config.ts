import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname) } },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    // Database-backed tests can be slow on a cold first run (fresh clone); 5s was flaky there.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Tests never depend on the developer's .env (set values win over it).
    env: { BURSAR_MODE: "dry-run", DATABASE_URL: "file:./test-unused.db", ONECLICK_API_KEY: "", NEAR_AI_API_KEY: "", BURSAR_FEE_BPS: "50", BURSAR_FEE_ACCOUNT_ID: "" },
  },
});
