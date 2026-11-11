import { agentAccount } from "../agent-account";
import { PayoutSchema } from "../domain";
import type { PrismaClient } from "../generated/prisma/client";
import { formatUsd, rescale, USD_DECIMALS } from "../money";
import { closeFinishedPlans, payItem, refreshPayments } from "../pay";
import { getPlan, prepareAgentRun } from "../plans";
import { quotePayout } from "../quotes";
import { localDay, paydayOnOrAfter } from "../schedule";
import { getBusiness } from "../store";
import { chainName } from "../tokens";
import { say, sayOnce } from "./say";
import { paydayNeed } from "./view";
import { pendingChanges } from "../pending-changes";
import { trustSignedPayees } from "../trust";
import { applyPlatformFee } from "../platform-fee";
import { friendlyError } from "../errors";

// Bursar's agent. It wakes every minute (lib/agent/loop.ts) and on events,
// and does the routine work on its own: follows payments on their way, works
// out what is due today, pays routine payments, retries the ones that are
// waiting, and hands exceptions to the owner. It never changes payees or
// rules, and the agent account still refuses anything outside the owner's
// signed limits.

export interface AgentRunReport {
  ran: boolean;
  note?: string;
  newPayments: number;
  attempted: number;
  sent: number;
  waiting: number;
  failed: number;
  delivered: number;
  needsOwner: number;
}

const EMPTY: AgentRunReport = { ran: false, newPayments: 0, attempted: 0, sent: 0, waiting: 0, failed: 0, delivered: 0, needsOwner: 0 };
const HOUR = 60 * 60_000;
const LEASE_MS = 10 * 60_000;
const daysUntil = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const dayWords = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export interface AgentRunOptions {
  now?: Date;
  /** "today" (the agent's normal run) or "payday" (the owner's "Run payday now": everything due by the coming payday). */
  dueBy?: "today" | "payday";
  quote?: typeof quotePayout;
}

// One run at a time per business in this process; a lease in the database keeps a second process (the Telegram bot) out.
const g = globalThis as unknown as { bursarAgentRuns?: Map<string, Promise<AgentRunReport>> };

/** Runs the agent for one business. `db` must be limited to that business (lib/tenant.ts). */
export async function runAgent(db: PrismaClient, options: AgentRunOptions = {}): Promise<AgentRunReport> {
  const business = await getBusiness(db);
  if (!business) return { ...EMPTY, note: "No business yet." };
  const runs = (g.bursarAgentRuns ??= new Map());
  const running = runs.get(business.id);
  if (running) return running;
  const run = withLease(db, () => agentRun(db, options)).finally(() => runs.delete(business.id));
  runs.set(business.id, run);
  return run;
}

async function withLease(db: PrismaClient, fn: () => Promise<AgentRunReport>): Promise<AgentRunReport> {
  const key = "agent_lease";
  const now = Date.now();
  const row = await db.setting.findUnique({ where: { key } });
  if (row && Date.parse(row.value) > now) return { ...EMPTY, note: "Another Bursar process is running the agent." };
  await db.setting.upsert({ where: { key }, update: { value: new Date(now + LEASE_MS).toISOString() }, create: { key, value: new Date(now + LEASE_MS).toISOString() } });
  try {
    return await fn();
  } finally {
    await db.setting.delete({ where: { key } }).catch(() => undefined);
  }
}

async function agentRun(db: PrismaClient, options: AgentRunOptions): Promise<AgentRunReport> {
  const now = options.now ?? new Date();
  const quote = options.quote ?? quotePayout;
  const report: AgentRunReport = { ...EMPTY, ran: true };
  const business = await getBusiness(db);
  if (!business) return { ...EMPTY, note: "No business yet." };
  const rules = business.rules;

  let account;
  try {
    account = await agentAccount(db);
  } catch (e) {
    const why = friendlyError(e);
    await sayOnce(db, "not-ready", 6 * HOUR, "agent_blocked", `I can't make payments yet: ${why}`);
    return { ...EMPTY, note: why };
  }

  // 1. Follow payments on their way and say when they arrive.
  const onTheWay = await db.planItem.findMany({ where: { payStatus: "sent" }, select: { id: true } });
  if (onTheWay.length) {
    await refreshPayments(db);
    const after = await db.planItem.findMany({ where: { id: { in: onTheWay.map((i) => i.id) } } });
    for (const i of after) {
      const token = PayoutSchema.nullable().parse(JSON.parse(i.payout))?.token;
      const where = token ? `${token.symbol} on ${chainName(token.chain)}` : "";
      if (i.payStatus === "delivered") {
        report.delivered++;
        await say(db, "payment_delivered", `${i.payeeName} received ${formatUsd(BigInt(i.amountUsd))} (${i.forWhat}) in ${where}.`, { itemId: i.id });
        // A one-time payee comes off the list once paid, as the owner asked when setting the payment up.
        // (Taking someone off only narrows who can be paid; adding or changing payees stays the owner's alone.)
        const payee = i.payeeId ? await db.payee.findFirst({ where: { id: i.payeeId, removedAt: null, removeAfterPaid: true } }) : null;
        const stillOwed = payee
          ? await db.planItem.count({ where: { payeeId: payee.id, placement: "in", payStatus: { in: ["planned", "waiting", "paying", "sent"] } } })
          : 0;
        if (payee && stillOwed === 0) {
          await db.payee.update({ where: { id: payee.id }, data: { removedAt: now } });
          await say(db, "agent_run", `${payee.name} has been paid, so I took them off your list as you asked.`);
        }
      } else if (i.payStatus === "refunded" || i.payStatus === "failed") {
        await say(db, "payment_failed", `The payment to ${i.payeeName} (${i.forWhat}) didn't arrive and the money came back to your Bursar wallet. This one needs you.`, { itemId: i.id });
      }
    }
  }

  // People the owner's wallet has signed in are trusted (their wallet OK covers the first payment).
  await applyPlatformFee(db);
  const trusted = await trustSignedPayees(db, now);
  if (trusted.length) await say(db, "agent_run", `Your wallet confirmed ${trusted.join(", ")}, so I'll pay them on their day without asking again.`);

  // 2. Money: say when a top-up arrives, and warn before payday if the wallet is short.
  const treasury = rules.treasury;
  const held = rescale((await account.status()).balances[treasury.assetId] ?? 0n, treasury.decimals, USD_DECIMALS);
  const last = await db.setting.findUnique({ where: { key: "agent_last_balance" } });
  if (last && held > BigInt(last.value)) {
    await say(db, "money_in", `Your Bursar wallet received ${formatUsd(held - BigInt(last.value))}. It now holds ${formatUsd(held)}.`);
    // Payments waiting for money get their try in this same run, not on the next check.
    const woke = await db.planItem.updateMany({ where: { payStatus: "waiting", payCode: "funds" }, data: { retryAt: now } });
    if (woke.count) await say(db, "agent_run", `Trying the ${woke.count} payment${woke.count === 1 ? "" : "s"} that ${woke.count === 1 ? "was" : "were"} waiting for money now.`);
  }
  await db.setting.upsert({ where: { key: "agent_last_balance" }, update: { value: held.toString() }, create: { key: "agent_last_balance", value: held.toString() } });
  const need = await paydayNeed(db, held, now);
  if (need && need.short > 0n && daysUntil(localDay(now, rules.timeZone), need.payday) <= 3) {
    await sayOnce(
      db,
      `short:${need.payday}`,
      20 * HOUR,
      "needs_money",
      `Payday (${dayWords(need.payday)}) needs ${formatUsd(need.due)} and your Bursar wallet holds ${formatUsd(held)}. Please add ${formatUsd(need.short)} so nobody waits.`,
    );
  }

  // Changes the owner made that their wallet hasn't confirmed: new people and higher limits wait for it.
  const unsigned = await pendingChanges(db);
  if (unsigned && !unsigned.onlyTighter) {
    await sayOnce(
      db,
      "unsigned-changes",
      12 * HOUR,
      "needs_owner",
      `Your wallet hasn't confirmed your latest changes yet (${unsigned.lines.join(", ")}). New people and higher limits take effect once you confirm, from the bar at the top of any page.`,
    );
  }

  // 3. Paused by the owner: do nothing else.
  if (rules.frozen) {
    await sayOnce(db, "paused", 12 * HOUR, "agent_paused", "Payments are paused, so I'm not paying anyone. Turn them back on in Spending rules when you're ready.");
    return report;
  }

  // 4. What is due: a new run of payments (autopilot), approved by the agent for routine ones.
  if (rules.autopilot) {
    const today = localDay(now, rules.timeZone);
    const dueBy = options.dueBy === "payday" ? paydayOnOrAfter(today, rules.paydayWeekday) : today;
    const run = await prepareAgentRun(db, now, dueBy, quote);
    if (run) {
      await db.plan.update({ where: { id: run.id }, data: { status: "approved", approvedAt: now, approvedBy: "agent" } });
      const items = run.items.filter((i) => i.placement === "in");
      const mine = items.filter((i) => !i.needsOwnTap);
      const yours = items.filter((i) => i.needsOwnTap);
      report.newPayments = items.length;
      const total = items.reduce((a, i) => a + i.amountUsd, 0n);
      const names = (xs: typeof items) => xs.map((i) => `${i.payeeName} (${formatUsd(i.amountUsd)})`).join(", ");
      await say(
        db,
        "agent_run",
        `${items.length} payment${items.length === 1 ? " is" : "s are"} due (${formatUsd(total)}).` +
          (mine.length ? ` Paying now: ${names(mine)}.` : "") +
          (yours.length ? ` Waiting for your OK: ${names(yours)}.` : ""),
        { planId: run.id },
      );
      for (const i of yours) {
        await say(db, "needs_owner", `I need your OK to pay ${i.payeeName} ${formatUsd(i.amountUsd)} (${i.forWhat}). ${i.ownTapReason ?? ""}`.trim(), { itemId: i.id });
      }
    }
  }

  // 5. Pay what is approved and due for a try: new ones, and waiting ones whose retry time has come.
  const ready = await db.planItem.findMany({
    where: {
      placement: "in",
      plan: { status: "approved" },
      payStatus: { in: ["planned", "waiting"] },
      OR: [{ retryAt: null }, { retryAt: { lte: now } }],
    },
    orderBy: { id: "asc" },
  });
  let balance: bigint | null = null;
  for (const row of ready) {
    if (row.needsOwnTap && !row.ownTapAt) {
      report.needsOwner++;
      continue;
    }
    // Live: someone the owner's wallet hasn't confirmed yet can't be paid; wait for that rather than be refused.
    if (account.backend === "agent-api" && row.payeeId) {
      const payee = await db.payee.findFirst({ where: { id: row.payeeId }, select: { trustedAt: true } });
      if (payee && !payee.trustedAt) {
        report.needsOwner++;
        continue;
      }
    }
    // Waiting for money: try again only once the wallet holds enough, so the log isn't filled with refusals.
    if (row.payCode === "funds") {
      balance ??= (await account.status()).balances[rules.treasury.assetId] ?? 0n;
      if (balance < BigInt(row.amountUsd)) {
        await db.planItem.update({ where: { id: row.id }, data: { retryAt: new Date(now.getTime() + 2 * 60_000) } });
        continue;
      }
    }
    const plan = await getPlan(db, row.planId);
    const item = plan?.items.find((i) => i.id === row.id);
    if (!item) continue;
    report.attempted++;
    const where = item.payout ? ` in ${item.payout.token.symbol} on ${chainName(item.payout.token.chain)}` : "";
    await say(db, "payment_started", `${row.attempts > 0 ? "Started again: paying" : "Started paying"} ${item.payeeName} ${formatUsd(item.amountUsd)} (${item.forWhat})${where}…`, { itemId: item.id });
    const status = await payItem(db, account, item, quote, now);
    if (status === "sent") report.sent++;
    else if (status === "waiting") report.waiting++;
    else if (status === "failed") report.failed++;
    balance = null;
  }

  await closeFinishedPlans(db);
  return report;
}
