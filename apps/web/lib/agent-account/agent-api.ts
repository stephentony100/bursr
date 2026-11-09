import { AgentApiError, createAgentApi, type AgentApi } from "@near-intents-agent-api/sdk";
import { parseUnits, USD_DECIMALS } from "../money";
import type { ActionRequest, RefusalCode } from "./evaluate";
import type { AccountStatus, ActionOutcome, AgentAccount, Outcome } from "./types";

// Live agent account on the NEAR Intents Agent API (mainnet). Bursar only
// asks; the API (destinations, budget) and its TEE wallet provider (assets,
// limits, freeze) refuse anything outside the owner's signed policy.
// The agent acts with a grant token only; it never holds the owner's key.

export interface AgentApiConfig {
  apiKey: string;
  baseUrl: string;
  agentId: string;
  grantToken: string;
}

function refusalFrom(e: AgentApiError): ActionOutcome {
  return {
    status: "refused",
    refusal: {
      code: e.code as RefusalCode,
      layer: (e.layer === "budget" || e.layer === "balance" ? e.layer : e.layer === "request" ? "request" : "policy"),
      message: e.detail ?? e.title,
    },
  };
}

export class AgentApiAccount implements AgentAccount {
  readonly backend = "agent-api" as const;
  private readonly api: AgentApi;
  private readonly agent: AgentApi;

  constructor(private readonly cfg: AgentApiConfig) {
    this.api = createAgentApi({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl });
    this.agent = this.api.forGrant(cfg.grantToken);
  }

  async status(): Promise<AccountStatus> {
    const [view, balances] = await Promise.all([
      this.api.getPolicy(this.cfg.agentId),
      // Deposits and payments use the confidential balance; the default (public) one stays empty.
      this.api.getBalances(this.cfg.agentId, { source: "confidential" }),
    ]);
    if (!view.policy) throw new Error("The agent has no applied policy yet.");
    const weekly = view.usage.budget.weekly;
    return {
      backend: this.backend,
      agentId: this.cfg.agentId,
      frozen: view.policy.frozen,
      policy: view.policy,
      policyRevision: view.revision ?? 0,
      spentThisWeekUsd: weekly.spent_usd ? parseUnits(weekly.spent_usd, USD_DECIMALS) : 0n,
      weekResetsAt: weekly.resets_at ? new Date(weekly.resets_at) : null,
      balances: Object.fromEntries(balances.balances.map((b) => [b.asset_id, BigInt(b.available_raw)])),
    };
  }

  private async call(req: ActionRequest, idempotencyKey: string | undefined, dry: boolean): Promise<ActionOutcome> {
    const opts = idempotencyKey ? { idempotencyKey } : {};
    try {
      if (req.kind === "withdraw") {
        const body = { asset: req.asset, amount: req.amount.toString(), chain: req.chain, recipient: req.recipient, ...(req.memo ? { memo: req.memo } : {}), confidential: true };
        if (dry) {
          const q = await this.agent.withdraw(this.cfg.agentId, { ...body, dry: true }, opts);
          return fromWarnings(q.warnings);
        }
        const r = await this.agent.withdraw(this.cfg.agentId, body, opts);
        return { status: "accepted", correlationId: r.correlation_id, simulated: false };
      }
      if (req.kind === "swap") {
        // Confidential, like the policy and the withdrawals: the swap uses the private balance.
        const body = { origin_asset: req.asset, destination_asset: req.destinationAsset, amount: req.amount.toString(), confidential: true };
        if (dry) {
          const q = await this.agent.swap(this.cfg.agentId, { ...body, dry: true });
          return fromWarnings(q.warnings);
        }
        const r = await this.agent.swap(this.cfg.agentId, body, opts);
        return { status: "accepted", correlationId: r.correlation_id, simulated: false };
      }
      const body = { asset: req.asset, amount: req.amount.toString(), recipient: req.recipient };
      const r = await this.agent.transfer(this.cfg.agentId, body, opts);
      return { status: "accepted", correlationId: r.correlation_id, simulated: false };
    } catch (e) {
      if (e instanceof AgentApiError && e.status >= 400 && e.status < 500 && !e.retryable) return refusalFrom(e);
      throw e;
    }
  }

  async outcome(correlationId: string): Promise<Outcome> {
    const s = await this.api.getStatus(correlationId);
    const d = (s.details ?? {}) as { amount_out?: string | null; destination_tx_hash?: string | null; tx_hash?: string | null; refund_tx_hash?: string | null; failure_reason?: string | null };
    switch (s.status) {
      case "SUCCESS":
        return { state: "done", amountOut: d.amount_out ? BigInt(d.amount_out) : undefined, txHash: d.destination_tx_hash ?? d.tx_hash ?? undefined };
      case "REFUNDED":
        return { state: "refunded", txHash: d.refund_tx_hash ?? undefined, reason: "The route could not complete; the money went back to the account." };
      case "FAILED":
        return { state: "failed", reason: d.failure_reason ?? s.failure_code ?? "Failed." };
      default:
        // PROCESSING, QUEUED, PENDING_APPROVAL, UNCERTAIN, NEEDS_REVIEW: not final yet.
        return { state: "pending", reason: s.status };
    }
  }

  execute(req: ActionRequest, idempotencyKey: string) {
    return this.call(req, idempotencyKey, false);
  }

  preview(req: ActionRequest) {
    return this.call(req, undefined, true);
  }
}

/** A dry preview "never refuses … it warns": the first rule warning becomes the refusal. */
function fromWarnings(warnings: ReadonlyArray<{ code: string; message?: string }> | undefined): ActionOutcome {
  const rule = warnings?.find((w) => w.code.startsWith("policy_") || w.code.startsWith("spend_") || w.code === "wallet_frozen" || w.code === "insufficient_balance");
  if (!rule) return { status: "accepted", correlationId: "preview", simulated: false };
  return { status: "refused", refusal: { code: rule.code as RefusalCode, layer: "policy", message: rule.message ?? rule.code } };
}
