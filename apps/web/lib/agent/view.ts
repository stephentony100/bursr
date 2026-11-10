import type { Payout } from "../domain";
import type { PrismaClient } from "../generated/prisma/client";
import { listInvoices } from "../invoices";
import { addDays, invoiceDueOn, lastDueOn, localDay, nextDueOn, paydayOnOrAfter } from "../schedule";
import { getBusiness, listPayees } from "../store";

// What the owner sees of the agent: what it's doing, what it needs from them,
// and what it will pay next. Read-only.

export interface FeedEntry {
  id: string;
  itemId: string | null;
  at: Date;
  by: "agent" | "owner";
  kind: string;
  message: string;
}

export interface NeedsYou {
  itemId: string;
  kind: "approve" | "failed" | "funds" | "payee" | "invite";
  payeeName: string;
  forWhat: string;
  amountUsd: bigint;
  reason: string;
}

export interface Upcoming {
  dueOn: string;
  payeeName: string;
  forWhat: string;
  amountUsd: bigint;
  payout: Payout | null;
}

const OWNER_KINDS_SHOWN = new Set([
  "plan_approved",
  "plan_item_approved",
  "plan_item_removed",
  "plan_item_updated",
  "payee_added",
  "payee_removed",
  "payout_changed",
  "rules_changed",
  "account_frozen",
  "account_unfrozen",
  "business_setup",
]);

export async function agentFeed(db: PrismaClient, take = 30): Promise<FeedEntry[]> {
  const rows = await db.auditEvent.findMany({ orderBy: { at: "desc" }, take: take * 3 });
  const entries: FeedEntry[] = rows
    .filter((r) => r.actor === "agent" || OWNER_KINDS_SHOWN.has(r.kind) || r.kind.startsWith("owner_"))
    .map((r) => {
      let itemId: string | null = null;
      try {
        itemId = (JSON.parse(r.data ?? "null") as { itemId?: string } | null)?.itemId ?? null;
      } catch {
        itemId = null;
      }
      const message = r.kind === "account_refused" ? `Your spending rules blocked a payment: ${r.message}` : r.message;
      return { id: r.id, itemId, at: r.at, by: r.actor === "agent" ? "agent" : "owner", kind: r.kind, message };
    });
  // "Paying X…" is only interesting until the payment has an outcome; then the outcome tells the story.
  const settled = new Set(entries.filter((e) => e.itemId && e.kind !== "payment_started").map((e) => e.itemId));
  return entries.filter((e) => !(e.kind === "payment_started" && settled.has(e.itemId))).slice(0, take);
}

export async function needsYou(db: PrismaClient): Promise<NeedsYou[]> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60_000);
  const rows = await db.planItem.findMany({
    where: {
      placement: "in",
      plan: { status: { in: ["approved", "done"] }, createdAt: { gte: since } },
      OR: [
        { needsOwnTap: true, ownTapAt: null, payStatus: "planned" },
        { payStatus: "failed" },
        { payStatus: "waiting", payCode: { in: ["funds", "payee"] } },
      ],
    },
    orderBy: { id: "asc" },
  });
  const invites = await db.payeeInvite.findMany({ where: { status: "submitted" }, orderBy: { submittedAt: "asc" } });
  const fromInvites: NeedsYou[] = invites.map((i) => ({
    itemId: i.id,
    kind: "invite",
    payeeName: i.name,
    forWhat: "New person",
    amountUsd: 0n,
    reason: "Sent how they want to be paid. Check it with them, then approve on People.",
  }));
  return fromInvites.concat(rows.map((r) => ({
    itemId: r.id,
    kind: r.payStatus === "failed" ? "failed" : r.payStatus === "waiting" ? (r.payCode as "funds" | "payee") : "approve",
    payeeName: r.payeeName,
    forWhat: r.forWhat,
    amountUsd: BigInt(r.amountUsd),
    reason: r.payStatus === "planned" ? (r.ownTapReason ?? "Needs your OK.") : (r.payReason ?? ""),
  })));
}

/** The next payments the agent will make by itself, over the coming two weeks. */
export async function comingUp(db: PrismaClient, now = new Date(), days = 14): Promise<Upcoming[]> {
  const business = await getBusiness(db);
  if (!business) return [];
  const rules = business.rules;
  const today = localDay(now, rules.timeZone);
  const until = addDays(today, days);
  const [payees, invoices, handled] = await Promise.all([
    listPayees(db),
    listInvoices(db),
    db.planItem.findMany({ where: { dueKey: { not: null }, placement: "in", payStatus: { notIn: ["failed", "refunded"] } }, select: { dueKey: true } }),
  ]);
  const done = new Set(handled.map((h) => h.dueKey!));
  const out: Upcoming[] = [];
  for (const p of payees) {
    if (!p.recurring) continue;
    const addedOn = localDay(new Date(p.addedAt), rules.timeZone);
    let from = today;
    const missed = lastDueOn(p.recurring, rules, addedOn, addDays(today, -1));
    if (missed && !done.has(`${p.id}@${missed}`)) from = missed;
    for (let d = nextDueOn(p.recurring, rules, addedOn, from); d && d <= until; d = nextDueOn(p.recurring, rules, addedOn, addDays(d, 1))) {
      if (done.has(`${p.id}@${d}`)) continue;
      const forWhat = p.recurring.every === "week" ? "Weekly pay" : p.recurring.every === "two_weeks" ? "Pay (every 2 weeks)" : "Monthly pay";
      out.push({ dueOn: d, payeeName: p.name, forWhat, amountUsd: BigInt(p.recurring.amountUsd), payout: p.payout });
    }
  }
  const byId = new Map(payees.map((p) => [p.id, p]));
  for (const inv of invoices) {
    if (!["ready", "flag"].includes(inv.status) || !inv.payeeId || done.has(`inv:${inv.id}`)) continue;
    const d = invoiceDueOn({ receivedOn: localDay(inv.receivedAt, rules.timeZone), dueDate: inv.extracted?.dueDate ?? null }, rules);
    if (d > until) continue;
    out.push({ dueOn: d < today ? today : d, payeeName: byId.get(inv.payeeId)?.name ?? inv.supplierName, forWhat: `Invoice #${inv.invoiceNumber || "?"}`, amountUsd: inv.totalUsd, payout: byId.get(inv.payeeId)?.payout ?? null });
  }
  return out.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.payeeName.localeCompare(b.payeeName));
}

export function nextPayday(now: Date, timeZone: string, paydayWeekday: number): string {
  return paydayOnOrAfter(localDay(now, timeZone), paydayWeekday);
}


/** What the coming payday needs against what the Bursar wallet holds (USD, 6 decimals). */
export async function paydayNeed(db: PrismaClient, balanceUsd: bigint, now = new Date()) {
  const business = await getBusiness(db);
  if (!business) return null;
  const payday = nextPayday(now, business.rules.timeZone, business.rules.paydayWeekday);
  const upcoming = (await comingUp(db, now)).filter((u) => u.dueOn <= payday).reduce((a, u) => a + u.amountUsd, 0n);
  // Plus what the agent is already holding: due, not sent yet (waiting for money, or for the owner's OK).
  const held = await db.planItem.findMany({ where: { placement: "in", payStatus: { in: ["planned", "waiting"] }, plan: { status: "approved" } }, select: { amountUsd: true } });
  const due = upcoming + held.reduce((a, i) => a + BigInt(i.amountUsd), 0n);
  return { payday, due, short: due > balanceUsd ? due - balanceUsd : 0n };
}
