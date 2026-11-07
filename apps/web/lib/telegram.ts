import { randomBytes } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client";
import { formatUsd } from "./money";
import { isOwnerSession, telegramOwnerSession, type OwnerSession } from "./owner";
import type { PlanView } from "./plans";
import { getBusiness } from "./store";

// Telegram for the owner (P1): the bot (scripts/bot.ts) shows the week's plan
// with an Approve button and sends alerts. Only the chat the owner linked with
// a one-time code from their signed-in web session can act as the owner.
// Every alert has a key and is sent once (idempotent by key).

const LINK_MS = 10 * 60 * 1000;
const PENDING = "telegram_link_pending";
const LINKED = "telegram_link";
export const BOT_NAME = "telegram_bot_username";

async function getSetting<T>(db: PrismaClient, key: string): Promise<T | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row ? (JSON.parse(row.value) as T) : null;
}
async function setSetting(db: PrismaClient, key: string, value: unknown) {
  const v = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

/** Owner only (web): a one-time code to link a Telegram chat, valid for 10 minutes. */
export async function createLinkCode(db: PrismaClient, owner: OwnerSession, now = Date.now()): Promise<string> {
  if (!isOwnerSession(owner)) throw new Error("Only the owner can connect Telegram.");
  const business = await getBusiness(db);
  if (!business || business.ownerAccountId !== owner.accountId) throw new Error("Only the owner can connect Telegram.");
  const code = randomBytes(4).toString("hex").toUpperCase();
  await setSetting(db, PENDING, { code, accountId: owner.accountId, expires: now + LINK_MS });
  return code;
}

/** Bot: `/link CODE` from a chat. Returns a reply for the chat. */
export async function linkChat(db: PrismaClient, chatId: number, code: string, now = Date.now()): Promise<string> {
  const pending = await getSetting<{ code: string; accountId: string; expires: number }>(db, PENDING);
  if (!pending || pending.expires < now || pending.code !== code.trim().toUpperCase()) {
    return "That code is wrong or expired. Get a new one on Bursar → Rules & account → Connect Telegram.";
  }
  await setSetting(db, LINKED, { chatId, accountId: pending.accountId, at: new Date(now).toISOString() });
  await db.setting.delete({ where: { key: PENDING } });
  return `Connected. This chat now acts for ${pending.accountId}. Send /plan to see this week's plan.`;
}

export async function linkedChat(db: PrismaClient): Promise<{ chatId: number; accountId: string } | null> {
  return getSetting(db, LINKED);
}

/** The owner session for a chat, only if it is the linked chat of the business's current owner. */
export async function ownerForChat(db: PrismaClient, chatId: number): Promise<OwnerSession | null> {
  const link = await linkedChat(db);
  const business = await getBusiness(db);
  if (!link || !business || link.chatId !== chatId || link.accountId !== business.ownerAccountId) return null;
  return telegramOwnerSession(link.accountId);
}

export function planText(plan: PlanView): string {
  const inPlan = plan.items.filter((i) => i.placement === "in");
  const out = plan.items.filter((i) => i.placement === "held" || i.placement === "deferred");
  const total = inPlan.reduce((a, i) => a + i.amountUsd, 0n);
  const lines = [
    plan.status === "draft" ? `This week's plan: ${formatUsd(total)} in ${inPlan.length} payments` : `Plan (${plan.status}): ${formatUsd(total)}`,
    ...inPlan.map((i) => `• ${i.payeeName}: ${formatUsd(i.amountUsd)} (${i.forWhat})${i.needsOwnTap && !i.ownTapAt ? " ⚠ needs your own tap in the web app" : ""}${plan.status !== "draft" ? ` — ${i.payStatus}` : ""}`),
  ];
  if (out.length) lines.push("", `Not in this plan (${out.length}):`, ...out.map((i) => `• ${i.payeeName}: ${i.reason}`));
  return lines.join("\n");
}

export interface Alert {
  key: string;
  text: string;
}

/** Alerts not yet sent: problem invoices, failed payments, refused attempts. */
export async function pendingAlerts(db: PrismaClient): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const invoices = await db.invoice.findMany({ where: { status: { in: ["block", "hold", "needs_owner"] } }, orderBy: { receivedAt: "asc" } });
  for (const i of invoices) {
    const results = JSON.parse(i.results) as { status: string; reason: string }[];
    const reason = [...results.filter((r) => r.status === "block" || r.status === "hold").map((r) => r.reason), i.needsOwner].filter(Boolean)[0] ?? "Needs your attention.";
    const word = i.status === "block" ? "🚫 Blocked" : "⏸ On hold";
    alerts.push({ key: `invoice:${i.id}`, text: `${word}: ${i.supplierName || i.fileName} #${i.invoiceNumber || "?"} (${formatUsd(BigInt(i.totalUsd))}).\n${reason}` });
  }
  const failed = await db.planItem.findMany({ where: { payStatus: "failed" } });
  for (const p of failed) alerts.push({ key: `failed:${p.id}`, text: `❌ Not paid: ${p.payeeName}, ${p.forWhat}.\n${p.payReason ?? ""}` });
  const refused = await db.auditEvent.findMany({ where: { kind: "account_refused" }, orderBy: { at: "asc" } });
  for (const r of refused) alerts.push({ key: `refused:${r.id}`, text: `🛡 The agent account refused a payment: ${r.message}` });

  const sent = new Set((await db.telegramMessage.findMany({ where: { key: { in: alerts.map((a) => a.key) } }, select: { key: true } })).map((m) => m.key));
  return alerts.filter((a) => !sent.has(a.key));
}

export async function markSent(db: PrismaClient, key: string) {
  await db.telegramMessage.upsert({ where: { key }, create: { key }, update: {} });
}
