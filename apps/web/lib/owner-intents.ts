import {
  AgentApiError,
  createAgentApi,
  createGrantCredential,
  type GenerateIntentResponse,
  type Policy,
  type SignedData,
} from "@near-intents-agent-api/sdk";
import { readEnv } from "./env";
import type { PrismaClient } from "./generated/prisma/client";
import { desiredPolicy, NotOwnerError } from "./owner-actions";
import { isOwnerSession, type OwnerSession } from "./owner";
import { getAccountRecord, getBusiness } from "./store";

// Live mode owner actions on the Agent API. Every one follows the documented
// four steps: our server prepares (generateIntent), the owner's wallet signs
// `intent.payload` exactly as returned, our server submits, then we follow the
// status. Bursar's server never holds the owner's key.

export type OwnerIntentKind = "agent_create" | "policy_update" | "agent_freeze" | "agent_unfreeze" | "grant_issue";

const OWNER_INTENT_WORDS: Record<OwnerIntentKind, string> = {
  agent_create: "You set up your Bursar wallet with your spending rules",
  policy_update: "You confirmed your new spending rules with your wallet",
  agent_freeze: "You paused all payments",
  agent_unfreeze: "You turned payments back on",
  grant_issue: "You allowed Bursar to make payments inside your rules",
};

export interface PreparedIntent {
  kind: OwnerIntentKind;
  correlationId: string;
  agentId: string;
  expiresAt: string;
  intent: GenerateIntentResponse["intent"];
  summary: string;
  /** agent_create / policy_update: the exact policy the owner is signing. */
  policy?: Policy;
}

// grant_issue: the grant token is created here and must stay on the server
// until the owner's signature is accepted. Kept in memory for the few minutes
// the intent is valid; never written to the database.
const pendingGrantTokens = new Map<string, { token: string; expiresAt: number }>();

function api() {
  const env = readEnv();
  if (!env.AGENT_API_KEY) throw new Error("Set AGENT_API_KEY in .env first.");
  return createAgentApi({ apiKey: env.AGENT_API_KEY, baseUrl: env.AGENT_API_BASE_URL });
}

async function assertLiveOwner(db: PrismaClient, owner: OwnerSession) {
  if (!isOwnerSession(owner) || owner.demo) throw new NotOwnerError("Sign in with your NEAR wallet first.");
  const business = await getBusiness(db);
  if (!business || business.ownerAccountId !== owner.accountId) throw new NotOwnerError();
  if (!owner.publicKey) throw new NotOwnerError("Sign in again so Bursar knows your wallet key.");
  return business;
}

function prepared(kind: OwnerIntentKind, g: GenerateIntentResponse, policy?: Policy): PreparedIntent {
  return {
    kind,
    correlationId: g.correlation_id,
    agentId: g.agent_id,
    expiresAt: g.expires_at,
    intent: g.intent,
    summary: g.preview.summary,
    policy,
  };
}

export async function prepareOwnerIntent(db: PrismaClient, owner: OwnerSession, kind: OwnerIntentKind): Promise<PreparedIntent> {
  const business = await assertLiveOwner(db, owner);
  const client = api();
  const record = await getAccountRecord(db);

  if (kind === "agent_create") {
    if (record) throw new Error("This business already has an agent account.");
    const policy = (await desiredPolicy(db))!;
    const g = await client.generateIntent({
      type: "agent_create",
      name: `Bursar: ${business.name}`.slice(0, 64),
      owner: { type: "near", account_id: owner.accountId, public_key: owner.publicKey! },
      policy,
    });
    return prepared(kind, g, policy);
  }

  if (!record) throw new Error("Create the agent account first.");
  if (kind === "policy_update") {
    const policy = (await desiredPolicy(db))!;
    const g = await client.generateIntent({ type: "policy_update", agent_id: record.agentId, policy, expected_revision: record.policyRevision });
    return prepared(kind, g, policy);
  }
  if (kind === "agent_freeze" || kind === "agent_unfreeze") {
    return prepared(kind, await client.generateIntent({ type: kind, agent_id: record.agentId }));
  }
  // grant_issue
  const { token, commitment } = createGrantCredential();
  const g = await client.generateIntent({
    type: "grant_issue",
    agent_id: record.agentId,
    label: "Bursar payments",
    credential: commitment,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
  pendingGrantTokens.set(g.correlation_id, { token, expiresAt: Date.parse(g.expires_at) });
  return prepared(kind, g);
}

export interface SubmitResult {
  status: string;
  failureCode: string | null;
  /** grant_issue only: shown to the owner once, to put in .env. */
  grantToken?: string;
}

export async function submitOwnerIntent(
  db: PrismaClient,
  owner: OwnerSession,
  p: { kind: OwnerIntentKind; correlationId: string; agentId: string; signedData: SignedData },
): Promise<SubmitResult> {
  await assertLiveOwner(db, owner);
  const client = api();
  try {
    await client.submitIntent({ type: p.kind, correlation_id: p.correlationId, signed_data: p.signedData });
  } catch (e) {
    if (e instanceof AgentApiError) return { status: "REFUSED", failureCode: e.code };
    throw e;
  }

  let status = await client.getStatus(p.correlationId, { waitMs: 30_000 });
  for (let i = 0; i < 6 && (status.status === "PROCESSING" || status.status === "QUEUED"); i++) {
    status = await client.getStatus(p.correlationId, { waitMs: 30_000 });
  }
  const result: SubmitResult = { status: status.status, failureCode: status.failure_code ?? null };
  if (status.status !== "SUCCESS") return result;

  // Store what the Agent API says is in force; never a policy sent by the browser.
  const view = await client.getPolicy(p.agentId);
  const applied = view.policy ?? (await desiredPolicy(db));
  if (p.kind === "agent_create") {
    await db.agentAccount.create({
      data: { backend: "agent-api", agentId: p.agentId, policy: JSON.stringify(applied), policyRevision: view.revision ?? 0 },
    });
  } else if (applied) {
    await db.agentAccount.update({
      where: { id: "main" },
      data: { policy: JSON.stringify(applied), policyRevision: view.revision ?? 0, signedAt: new Date() },
    });
  }
  await db.auditEvent.create({
    data: { kind: `owner_${p.kind}`, actor: owner.accountId, message: OWNER_INTENT_WORDS[p.kind], data: JSON.stringify({ correlationId: p.correlationId }) },
  });
  if (p.kind === "grant_issue") {
    const pending = pendingGrantTokens.get(p.correlationId);
    pendingGrantTokens.delete(p.correlationId);
    result.grantToken = pending?.token;
  }
  return result;
}
