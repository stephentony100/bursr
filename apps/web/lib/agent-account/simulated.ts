import type { Policy } from "@near-intents-agent-api/sdk";
import type { PrismaClient } from "../generated/prisma/client";
import { evaluate, spentThisWeek, weekPeriodStart, type AccountState, type ActionRequest } from "./evaluate";
import type { AccountStatus, ActionOutcome, AgentAccount } from "./types";

// Dry-run agent account: the policy and balances live in SQLite and every
// request is judged by evaluate(), the same rules the Agent API applies.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function toJson(req: ActionRequest): string {
  return JSON.stringify({ ...req, amount: req.amount.toString() });
}

export class SimulatedAccount implements AgentAccount {
  readonly backend = "simulated" as const;

  constructor(
    private readonly db: PrismaClient,
    private readonly decimals: Record<string, number>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async load(): Promise<AccountState & { revision: number }> {
    const row = await this.db.agentAccount.findUnique({ where: { id: "main" } });
    if (!row) throw new Error("No agent account yet. Set up the rules first.");
    const spends = await this.db.accountAction.findMany({
      where: { outcome: "accepted", kind: { not: "swap" } },
      select: { at: true, usdMicros: true },
    });
    const balances = Object.fromEntries(
      Object.entries(JSON.parse(row.simBalances) as Record<string, string>).map(([k, v]) => [k, BigInt(v)]),
    );
    return {
      policy: JSON.parse(row.policy) as Policy,
      budgetStartedAt: row.budgetStartedAt,
      spends: spends.map((s) => ({ at: s.at, usdMicros: BigInt(s.usdMicros) })),
      balances,
      decimals: this.decimals,
      revision: row.policyRevision,
    };
  }

  async status(): Promise<AccountStatus> {
    const s = await this.load();
    const now = this.now();
    return {
      backend: this.backend,
      agentId: "dry-run",
      frozen: s.policy.frozen,
      policy: s.policy,
      policyRevision: s.revision,
      spentThisWeekUsd: spentThisWeek(s, now),
      weekResetsAt:
        s.policy.budget.weekly_usd === null
          ? null
          : new Date(weekPeriodStart(s.budgetStartedAt, now).getTime() + WEEK_MS),
      balances: s.balances,
    };
  }

  async preview(req: ActionRequest): Promise<ActionOutcome> {
    const v = evaluate(await this.load(), req, this.now());
    return v.ok ? { status: "accepted", correlationId: "preview", simulated: true } : { status: "refused", refusal: v.refusal };
  }

  async execute(req: ActionRequest, idempotencyKey: string): Promise<ActionOutcome> {
    const prior = await this.db.accountAction.findUnique({ where: { idempotencyKey } });
    if (prior) return replay(prior);

    const state = await this.load();
    const now = this.now();
    const v = evaluate(state, req, now);
    if (!v.ok) {
      await this.db.$transaction([
        this.db.accountAction.create({
          data: {
            idempotencyKey,
            at: now,
            kind: req.kind,
            request: toJson(req),
            outcome: "refused",
            code: v.refusal.code,
            message: v.refusal.message,
          },
        }),
        this.db.auditEvent.create({
          data: { at: now, kind: "account_refused", actor: "agent", message: v.refusal.message, data: toJson(req) },
        }),
      ]);
      return { status: "refused", refusal: v.refusal };
    }

    const balances = { ...state.balances };
    balances[req.asset] = (balances[req.asset] ?? 0n) - req.amount;
    if (req.kind === "swap") {
      // Stablecoin to stablecoin at par in dry-run; live swaps are priced by the market.
      const to = req.destinationAsset;
      const scaled = (req.amount * 10n ** BigInt(this.decimals[to] ?? 6)) / 10n ** BigInt(this.decimals[req.asset]);
      balances[to] = (balances[to] ?? 0n) + scaled;
    }
    const correlationId = `sim_${idempotencyKey}`;
    await this.db.$transaction([
      this.db.accountAction.create({
        data: {
          idempotencyKey,
          at: now,
          kind: req.kind,
          request: toJson(req),
          outcome: "accepted",
          usdMicros: v.usdMicros.toString(),
          correlationId,
        },
      }),
      this.db.agentAccount.update({
        where: { id: "main" },
        data: { simBalances: JSON.stringify(Object.fromEntries(Object.entries(balances).map(([k, b]) => [k, b.toString()]))) },
      }),
    ]);
    return { status: "accepted", correlationId, simulated: true };
  }
}

function replay(row: { outcome: string; code: string | null; message: string | null; correlationId: string | null }): ActionOutcome {
  if (row.outcome === "accepted") return { status: "accepted", correlationId: row.correlationId ?? "", simulated: true };
  return {
    status: "refused",
    refusal: { code: (row.code ?? "policy_denied") as never, layer: "policy", message: row.message ?? "" },
  };
}
