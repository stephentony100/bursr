import { z } from "zod";

// Every environment variable the app reads is declared here and listed in the
// root .env.example. Everything has a dry-run-safe default, so the app runs
// with no .env at all.

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const EnvSchema = z.object({
  BURSAR_MODE: z.enum(["dry-run", "live"]).default("dry-run"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("file:./dev.db"),

  NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  NEAR_RPC_URL: optional,

  // Live backend only; dry-run always uses the local policy simulator.
  AGENT_ACCOUNT_BACKEND: z.enum(["agent-api", "vault"]).default("agent-api"),
  AGENT_API_BASE_URL: z.string().default("https://api.demo.agentsonintents.com"),
  AGENT_API_KEY: optional,
  AGENT_API_AGENT_ID: optional,
  AGENT_API_GRANT_TOKEN: optional,
  VAULT_CONTRACT_ID: optional,
  AGENT_ACCOUNT_ID: optional,
  AGENT_FUNCTION_CALL_PRIVATE_KEY: optional,

  ONECLICK_BASE_URL: z.string().default("https://1click.chaindefuser.com"),
  ONECLICK_API_KEY: optional,
  ONECLICK_SLIPPAGE_BPS: z.coerce.number().int().min(0).max(10_000).default(100),
  BURSAR_FEE_ACCOUNT_ID: optional,
  BURSAR_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),

  NEAR_AI_BASE_URL: z.string().default("https://cloud-api.near.ai/v1"),
  NEAR_AI_API_KEY: optional,
  NEAR_AI_MODEL: optional,

  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_OWNER_CHAT_ID: optional,
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

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return EnvSchema.parse(clean(source));
}

export const isDryRun = (env: Env = readEnv()) => env.BURSAR_MODE === "dry-run";
