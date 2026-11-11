import type { Policy } from "@near-intents-agent-api/sdk";
import { z } from "zod";
import { PayeeSchema, PayoutSchema, PriceItemSchema, RulesSchema, type Payee, type Rules } from "./domain";
import type { PrismaClient } from "./generated/prisma/client";

// Read side of the data. Rows are JSON-validated on every read. Writes to
// rules and payees live in lib/owner-actions.ts (owner only).

export interface BusinessRecord {
  id: string;
  name: string;
  ownerAccountId: string;
  rules: Rules;
}

export async function getBusiness(db: PrismaClient): Promise<BusinessRecord | null> {
  const row = await db.business.findUnique({ where: { id: "main" } });
  if (!row) return null;
  return { id: row.id, name: row.name, ownerAccountId: row.ownerAccountId, rules: RulesSchema.parse(JSON.parse(row.rules)) };
}

const RecurringSchema = PayeeSchema.shape.recurring;

type PayeeRow = Awaited<ReturnType<PrismaClient["payee"]["findMany"]>>[number];

export function payeeFromRow(row: PayeeRow): Payee {
  return {
    id: row.id,
    name: row.name,
    category: z.enum(["supplier", "staff", "software"]).parse(row.category),
    payout: PayoutSchema.parse(JSON.parse(row.payout)),
    prices: z.array(PriceItemSchema).parse(JSON.parse(row.prices)),
    recurring: RecurringSchema.parse(JSON.parse(row.recurring)),
    addedAt: row.addedAt.toISOString(),
    payoutChangedAt: row.payoutChangedAt?.toISOString() ?? null,
    trustedAt: row.trustedAt?.toISOString() ?? null,
    removeAfterPaid: row.removeAfterPaid,
  };
}

export async function listPayees(db: PrismaClient): Promise<Payee[]> {
  const rows = await db.payee.findMany({ where: { removedAt: null }, orderBy: { name: "asc" } });
  return rows.map(payeeFromRow);
}

export async function getPayee(db: PrismaClient, id: string): Promise<Payee | null> {
  const row = await db.payee.findFirst({ where: { id, removedAt: null } });
  return row ? payeeFromRow(row) : null;
}

export interface AccountRecord {
  backend: string;
  agentId: string;
  /** The policy the account enforces now (last one the owner signed). */
  policy: Policy;
  policyRevision: number;
  budgetStartedAt: Date;
  /** Live only: the sealed payment pass (lib/grant-store.ts). */
  grantSealed: string | null;
  grantExpiresAt: Date | null;
}

export async function getAccountRecord(db: PrismaClient): Promise<AccountRecord | null> {
  const row = await db.agentAccount.findUnique({ where: { id: "main" } });
  if (!row) return null;
  return {
    backend: row.backend,
    agentId: row.agentId,
    policy: JSON.parse(row.policy) as Policy,
    policyRevision: row.policyRevision,
    budgetStartedAt: row.budgetStartedAt,
    grantSealed: row.grantSealed,
    grantExpiresAt: row.grantExpiresAt,
  };
}

export async function recentAudit(db: PrismaClient, take = 20) {
  return db.auditEvent.findMany({ orderBy: { at: "desc" }, take });
}
