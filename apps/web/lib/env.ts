import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// The one .env lives at the repo root. Next.js only reads apps/web/.env*, and
// @next/env caches its first load, so load the root file here, once, for every
// server-side reader (pages, actions, scripts). Variables already set win.
let rootEnvLoaded = false;
function loadRootEnv() {
  if (rootEnvLoaded) return;
  rootEnvLoaded = true;
  for (const dir of [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")]) {
    const file = path.join(dir, ".env");
    if (existsSync(file) && existsSync(path.join(dir, "AGENTS.md"))) {
      config({ path: file, quiet: true });
      return;
    }
  }
}

// Every environment variable the app reads is declared here and listed in the
// root .env.example. Everything has a dry-run-safe default, so the app runs
// with no .env at all.

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const EnvSchema = z.object({
  BURSAR_MODE: z.enum(["dry-run", "live"]).default("dry-run"),
  // The agent runs in the background while the app runs; "off" stops it (tests, scripts).
  BURSAR_AGENT: z.enum(["on", "off"]).default("on"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  BURSAR_SESSION_SECRET: optional,

  // The Agent API and NEAR Intents exist only on mainnet, so the owner signs in with a mainnet account.
  NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("mainnet"),
  NEAR_RPC_URL: optional.transform((v) => v ?? "https://rpc.mainnet.near.org"),

  // Live backend only; dry-run always uses the local policy simulator.
  AGENT_ACCOUNT_BACKEND: z.enum(["agent-api", "vault"]).default("agent-api"),
  AGENT_API_BASE_URL: z.string().default("https://api.demo.agentsonintents.com"),
  AGENT_API_KEY: optional,
  AGENT_API_AGENT_ID: optional,
  // 32 random bytes as hex; seals the agent's payment pass in the database (lib/grant-store.ts). Live only.
  BURSAR_DATA_KEY: optional,
  VAULT_CONTRACT_ID: optional,
  AGENT_ACCOUNT_ID: optional,
  AGENT_FUNCTION_CALL_PRIVATE_KEY: optional,

  ONECLICK_BASE_URL: z.string().default("https://1click.chaindefuser.com"),
  ONECLICK_API_KEY: optional,
  ONECLICK_SLIPPAGE_BPS: z.coerce.number().int().min(0).max(10_000).default(100),
  BURSAR_FEE_ACCOUNT_ID: optional,
  // Bursar's fee per plan in basis points (50 = 0.5%). Practice mode pays it to a made-up account;
  // live mode needs BURSAR_FEE_ACCOUNT_ID (a NEAR account receiving USDC), otherwise no fee.
  BURSAR_FEE_BPS: z.coerce.number().int().min(0).max(500).default(50),

  NEAR_AI_BASE_URL: z.string().default("https://cloud-api.near.ai/v1"),
  NEAR_AI_API_KEY: optional,
  NEAR_AI_MODEL: optional,

  TELEGRAM_BOT_TOKEN: optional,
});

export type Env = z.infer<typeof EnvSchema>;

/** Strips inline `# comments` that some .env loaders leave on values. */
function clean(source: Record<string, string | undefined>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(source)) {
    out[k] = v?.replace(/\s+#.*$/, "");
  }
  return out;
}

export function readEnv(source?: Record<string, string | undefined>): Env {
  if (!source) loadRootEnv();
  return EnvSchema.parse(clean(source ?? process.env));
}

export const isDryRun = (env: Env = readEnv()) => env.BURSAR_MODE === "dry-run";
