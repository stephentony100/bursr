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
  // Terminal scripts only, when one Bursr holds several businesses: the owner's NEAR account.
  BURSAR_OWNER: optional,
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  BURSAR_SESSION_SECRET: optional,
  // Live only: the passkey domain (WebAuthn rp_id). Defaults to the hostname of NEXT_PUBLIC_APP_URL.
  // Passkeys made under one domain only work there, so set it once and keep it (bursr.xyz in production).
  BURSAR_PASSKEY_RP_ID: optional,

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
  // Bursr's fee per plan in basis points (50 = 0.5%). Practice mode pays it to a made-up account;
  // live mode needs BURSAR_FEE_ACCOUNT_ID (a NEAR account receiving USDC), otherwise no fee.
  BURSAR_FEE_BPS: z.coerce.number().int().min(0).max(500).default(50),

  NEAR_AI_BASE_URL: z.string().default("https://cloud-api.near.ai/v1"),
  NEAR_AI_API_KEY: optional,
  NEAR_AI_MODEL: optional,
  // The agent you chat with (needs tool calling). Default: Qwen/Qwen3.6-35B-A3B-FP8, which runs in a verifiable TEE.
  NEAR_AI_CHAT_MODEL: optional,

  TELEGRAM_BOT_TOKEN: optional,

  // Which chain live mode runs on. "stellar": the Stellar edition (testnet): owners sign in with a Stellar
  // wallet and each business's Soroban vault (contracts/bursr-stellar-vault) holds its USDC and enforces the rules.
  BURSR_CHAIN: z.enum(["near", "stellar"]).default("near"),
  // testnet (default) or mainnet. Contract IDs and URLs per network: lib/stellar-network.ts.
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  // Overrides; empty means the network's own (mainnet has no public default RPC: set STELLAR_RPC_URL).
  STELLAR_RPC_URL: optional,
  STELLAR_NETWORK_PASSPHRASE: optional,
  STELLAR_FRIENDBOT_URL: optional,
  STELLAR_HORIZON_URL: optional,
  // Secret key of Bursr's fee account: it pays the network fees of passkey owners' transactions
  // and starts each agent's account. Holds a little XLM only, never business money.
  STELLAR_FEE_SECRET: optional,

  // Naira in and out (lib/ramp.ts). "practice": no real money, Stellar testnet only. "live": Linq's business API.
  LINQ_MODE: z.enum(["practice", "live"]).default("practice"),
  LINQ_BASE_URL: optional,
  LINQ_API_KEY: optional,
  LINQ_WEBHOOK_SECRET: optional,
  // The uploaded vault wasm (public, not a secret). Each business deploys its own vault from it.
  STELLAR_VAULT_WASM_HASH: z.string().default("947b22793dfd1a660bd486f9b3aec2448f892d10f4950064e880b02d76b363d4"),
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
