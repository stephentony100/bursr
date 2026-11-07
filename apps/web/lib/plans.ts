import { agentAccount } from "./agent-account";
import { PayoutSchema, type Payout } from "./domain";
import type { PrismaClient } from "./generated/prisma/client";
import { listInvoices } from "./invoices";
import { buildPlan } from "./plan";
import { quotePayout, type PayoutQuote } from "./quotes";
import { getBusiness, listPayees } from "./store";

// Plans in the database. The agent side builds a draft plan; only the owner
// approves it (lib/owner-actions.ts); lib/pay.ts pays approved items through
// the agent account.

export interface PlanItemView {
  id: string;
  kind: "invoice" | "wages" | "fee";
  invoiceId: string | null;
  payeeId: string;
  payeeName: string;
  forWhat: string;
  amountUsd: bigint;
  /** null for a held invoice whose supplier is not a payee. */
  payout: Payout | null;
  placement: "in" | "held" | "deferred" | "removed";
  reason: string | null;
  needsOwnTap: boolean;
  ownTapReason: string | null;
  ownTapAt: Date | null;
  quote: PayoutQuote | null;
  quoteError: string | null;
  payStatus: "planned" | "paying" | "sent" | "delivered" | "failed" | "refunded";
  payReason: string | null;
  sentAt: Date | null;
  amountSent: bigint | null;
  amountReceived: bigint | null;
  references: string[];
}

export interface PlanView {
  id: string;
  createdAt: Date;
  status: "draft" | "approved" | "done";
  approvedAt: Date | null;
  approvedBy: string | null;
  capLeftUsd: bigint;
  items: PlanItemView[];
}

type PlanRow = NonNullable<Awaited<ReturnType<typeof loadPlanRow>>>;
function loadPlanRow(db: PrismaClient, where: { id?: string }) {
  return db.plan.findFirst({ where, orderBy: { createdAt: "desc" }, include: { items: { orderBy: { id: "asc" } } } });
}

function planFromRow(r: PlanRow): PlanView {
  return {
    id: r.id,
    createdAt: r.createdAt,
    status: r.status as PlanView["status"],
    approvedAt: r.approvedAt,
    approvedBy: r.approvedBy,
    capLeftUsd: BigInt(r.capLeftUsd),
    items: r.items.map((i) => ({
      id: i.id,
      kind: i.kind as PlanItemView["kind"],
      invoiceId: i.invoiceId,
      payeeId: i.payeeId,
      payeeName: i.payeeName,
      forWhat: i.forWhat,
      amountUsd: BigInt(i.amountUsd),
      payout: PayoutSchema.nullable().parse(JSON.parse(i.payout)),
      placement: i.placement as PlanItemView["placement"],
      reason: i.reason,
      needsOwnTap: i.needsOwnTap,
      ownTapReason: i.ownTapReason,
      ownTapAt: i.ownTapAt,
      quote: i.quote ? (JSON.parse(i.quote) as PayoutQuote) : null,
      quoteError: i.quoteError,
      payStatus: i.payStatus as PlanItemView["payStatus"],
      payReason: i.payReason,
      sentAt: i.sentAt,
      amountSent: i.amountSent ? BigInt(i.amountSent) : null,
      amountReceived: i.amountReceived ? BigInt(i.amountReceived) : null,
      references: JSON.parse(i.references) as string[],
    })),
  };
}

export async function getLatestPlan(db: PrismaClient): Promise<PlanView | null> {
  const r = await loadPlanRow(db, {});
  return r ? planFromRow(r) : null;
}

export async function getPlan(db: PrismaClient, id: string): Promise<PlanView | null> {
  const r = await loadPlanRow(db, { id });
  return r ? planFromRow(r) : null;
}

const SIX_DAYS = 6 * 24 * 60 * 60 * 1000;

/** Builds this week's plan as a draft (replacing any earlier draft) and prices each payment with a dry quote. */
export async function prepareWeeklyPlan(db: PrismaClient, now = new Date(), quote: typeof quotePayout = quotePayout): Promise<PlanView> {
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");
  const [payees, invoices, status] = await Promise.all([listPayees(db), listInvoices(db), (await agentAccount(db)).status()]);

  const paidItems = await db.planItem.findMany({
    where: { plan: { status: { in: ["approved", "done"] } }, placement: "in", payStatus: { notIn: ["failed", "refunded"] } },
    select: { invoiceId: true, kind: true, payeeId: true, sentAt: true, plan: { select: { approvedAt: true } } },
  });
  const handledInvoiceIds = new Set(paidItems.map((i) => i.invoiceId).filter((x): x is string => Boolean(x)));
  const wagesPaidPayeeIds = new Set(
    paidItems
      .filter((i) => i.kind === "wages" && now.getTime() - (i.sentAt ?? i.plan.approvedAt ?? now).getTime() < SIX_DAYS)
      .map((i) => i.payeeId),
  );

  const draft = buildPlan({
    invoices: [...invoices].reverse(), // oldest first
    payees,
    rules: business.rules,
    spentThisWeekUsd: status.spentThisWeekUsd,
    handledInvoiceIds,
    wagesPaidPayeeIds,
    now,
  });

  // Price the payments that are in the plan (in parallel, a few at a time).
  const quotes = new Map<number, { quote: PayoutQuote | null; error: string | null }>();
  const inPlan = draft.items.map((it, i) => ({ it, i })).filter(({ it }) => it.placement === "in");
  for (let k = 0; k < inPlan.length; k += 3) {
    await Promise.all(
      inPlan.slice(k, k + 3).map(async ({ it, i }) => {
        let q = await quote(business.rules.treasury, it.payout!, it.amountUsd);
        if (!q.ok) {
          // One retry: 1Click sometimes fails a single request under load.
          await new Promise((r) => setTimeout(r, 1500));
          q = await quote(business.rules.treasury, it.payout!, it.amountUsd);
        }
        quotes.set(i, q.ok ? { quote: q.quote, error: null } : { quote: null, error: q.reason });
      }),
    );
  }

  const old = await db.plan.findMany({ where: { status: "draft" }, select: { id: true } });
  const created = await db.$transaction(async (tx) => {
    await tx.planItem.deleteMany({ where: { planId: { in: old.map((p) => p.id) } } });
    await tx.plan.deleteMany({ where: { id: { in: old.map((p) => p.id) } } });
    return tx.plan.create({
      data: {
        createdAt: now,
        capLeftUsd: draft.capLeftUsd.toString(),
        items: {
          create: draft.items.map((it, i) => ({
            kind: it.kind,
            invoiceId: it.invoiceId,
            payeeId: it.payeeId,
            payeeName: it.payeeName,
            forWhat: it.forWhat,
            amountUsd: it.amountUsd.toString(),
            payout: JSON.stringify(it.payout),
            placement: it.placement,
            reason: it.reason,
            needsOwnTap: it.needsOwnTap,
            ownTapReason: it.ownTapReason,
            quote: quotes.get(i)?.quote ? JSON.stringify(quotes.get(i)!.quote) : null,
            quoteError: quotes.get(i)?.error ?? null,
          })),
        },
      },
    });
  });
  return (await getPlan(db, created.id))!;
}
