import type { Policy } from "@near-intents-agent-api/sdk";
import type { ActionRequest, Refusal } from "./evaluate";

export type { ActionRequest, Refusal };

export interface AccountStatus {
  backend: "simulated" | "agent-api";
  agentId: string;
  frozen: boolean;
  policy: Policy;
  policyRevision: number;
  /** USD counted this 7-day period, 6 decimals. */
  spentThisWeekUsd: bigint;
  weekResetsAt: Date | null;
  balances: Record<string, bigint>;
}

export type ActionOutcome =
  | { status: "refused"; refusal: Refusal }
  /** Live: accepted by the account; follow correlationId to the end. Dry-run: done at once. */
  | { status: "accepted"; correlationId: string; simulated: boolean };

/**
 * The one interface all payment code uses (PRD §7). The agent can only ask;
 * the account decides. Owner actions (rules, payees, freeze) are NOT here:
 * they live in lib/owner-actions.ts and need the owner's session/signature.
 */
export interface AgentAccount {
  readonly backend: "simulated" | "agent-api";
  status(): Promise<AccountStatus>;
  /** Asks the account to act. Same idempotency key → same outcome, never a second payment. */
  execute(req: ActionRequest, idempotencyKey: string): Promise<ActionOutcome>;
  /** Asks what the account would say, moving nothing. */
  preview(req: ActionRequest): Promise<ActionOutcome>;
}
