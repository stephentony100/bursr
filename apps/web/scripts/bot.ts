// npm run bot: Bursr's Telegram bot (P1). Long polling; needs TELEGRAM_BOT_TOKEN.
//   /link CODE  connect this chat (code from Rules & account → Connect Telegram)
//   /plan       this week's plan, with an Approve button
//   any text    talk to Bursr's agent (same agent and tools as the web chat)
// Alerts (blocked/held invoices, failed payments, refused attempts, and the
// agent's news: what it paid, what needs your OK, money it needs) go to the
// linked chat once each. Approving here is the same owner action as on the web.
import "./load-env";
import { Bot, InlineKeyboard } from "grammy";
import { agentAccount } from "../lib/agent-account";
import { db } from "../lib/db";
import { readEnv } from "../lib/env";
import { randomUUID } from "node:crypto";
import { chat, confirmCard, type ChatTurn } from "../lib/agent/chat";
import { runAgent } from "../lib/agent/engine";
import { approvePlan, approvePlanItem } from "../lib/owner-actions";
import { payApprovedPlan } from "../lib/pay";
import { getLatestPlan, getPlan } from "../lib/plans";
import { BOT_NAME, hasLinkCode, linkChat, linkedChat, markSent, ownerForChat, pendingAlerts, planText } from "../lib/telegram";
import { allBusinessIds, scoped } from "../lib/tenant";
import { friendlyError } from "../lib/errors";

const env = readEnv();
if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN in .env (from @BotFather).");
const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const web = env.NEXT_PUBLIC_APP_URL;

/** The business a chat is linked to, and its owner (one bot serves every business on this Bursr). */
async function forChat(chatId: number | undefined) {
  if (chatId === undefined) return null;
  for (const id of await allBusinessIds(db())) {
    const bdb = scoped(db(), id);
    const owner = await ownerForChat(bdb, chatId);
    if (owner) return { bdb, owner };
  }
  return null;
}

bot.command("start", (ctx) =>
  ctx.reply(
    "Hi, I'm Bursr's agent. I check your supplier invoices for fraud and pay your staff and suppliers on their day, inside the limits you set. I'll message you here when something needs you, and you can just talk to me.\n\n" +
      "To connect: open Bursr → Limits → Connect my Telegram, then send me the /link line it shows you.",
  ),
);

bot.command("link", async (ctx) => {
  // The business whose Telegram code this is.
  for (const id of await allBusinessIds(db())) {
    const bdb = scoped(db(), id);
    if (await hasLinkCode(bdb, ctx.match ?? "")) return ctx.reply(await linkChat(bdb, ctx.chat.id, ctx.match ?? ""));
  }
  await ctx.reply("That code is wrong or expired. Get a new one in Bursr → Limits → Connect my Telegram.");
});

bot.command("plan", async (ctx) => {
  const b = await forChat(ctx.chat.id);
  if (!b) return ctx.reply("This chat isn't connected yet. Send /start to see how.");
  const plan = await getLatestPlan(b.bdb);
  if (!plan) return ctx.reply(`Nothing waiting yet. Get this week's payments ready at ${web}/payments`);
  const keyboard = plan.status === "draft" ? new InlineKeyboard().text("✅ Approve and pay everyone", `approve:${plan.id}`) : undefined;
  await ctx.reply(`${planText(plan)}\n\nSee the details: ${web}/payments`, { reply_markup: keyboard });
});

bot.callbackQuery(/^approve:(.+)$/, async (ctx) => {
  const b = await forChat(ctx.chat?.id);
  if (!b) return ctx.answerCallbackQuery({ text: "This chat isn't connected.", show_alert: true });
  const owner = b.owner;
  const planId = ctx.match[1];
  try {
    await approvePlan(b.bdb, owner, planId);
  } catch (e) {
    return ctx.answerCallbackQuery({ text: friendlyError(e).slice(0, 190), show_alert: true });
  }
  await ctx.answerCallbackQuery({ text: "Approved. Paying everyone now…" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  const results = await payApprovedPlan(b.bdb, await agentAccount(b.bdb), planId);
  const sent = Object.values(results).filter((s) => s === "sent").length;
  const failed = Object.values(results).length - sent;
  await ctx.reply(`Done. ${sent} payments on the way${failed ? `, ${failed} not paid (see why below)` : ""}.\n\n${planText((await getPlan(b.bdb, planId))!)}`);
});

// A payment waiting for the owner: OK it from the chat; the agent pays it at once.
bot.callbackQuery(/^ok:(.+)$/, async (ctx) => {
  const b = await forChat(ctx.chat?.id);
  if (!b) return ctx.answerCallbackQuery({ text: "This chat isn't connected.", show_alert: true });
  const owner = b.owner;
  try {
    await approvePlanItem(b.bdb, owner, ctx.match[1]);
  } catch (e) {
    return ctx.answerCallbackQuery({ text: friendlyError(e).slice(0, 190), show_alert: true });
  }
  await ctx.answerCallbackQuery({ text: "OK'd. Paying now…" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  const r = await runAgent(b.bdb);
  await ctx.reply(r.sent ? "Sent. I'll tell you when it arrives." : "OK'd. I'll pay it as soon as I can and tell you here.");
});

// Talking to the agent. Action cards become buttons; callback data is short, so the card's signed token stays here.
const histories = new Map<number, ChatTurn[]>();
const cardTokens = new Map<string, string>();
bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;
  const b = await forChat(ctx.chat.id);
  if (!b) return ctx.reply("This chat isn't connected yet. Send /start to see how.");
  const owner = b.owner;
  const history = [...(histories.get(ctx.chat.id) ?? []), { role: "user" as const, content: ctx.message.text.slice(0, 2000) }].slice(-12);
  await ctx.replyWithChatAction("typing");
  const r = await chat(b.bdb, owner, history);
  histories.set(ctx.chat.id, [...history, { role: "assistant" as const, content: r.reply }].slice(-12));
  await ctx.reply(r.reply);
  for (const c of r.cards) {
    const id = randomUUID().slice(0, 12);
    cardTokens.set(id, c.token);
    await ctx.reply(`${c.title}\n${c.detail}`, { reply_markup: new InlineKeyboard().text(c.confirm, `card:${id}`) });
  }
});

bot.callbackQuery(/^card:(.+)$/, async (ctx) => {
  const b = await forChat(ctx.chat?.id);
  const owner = b?.owner;
  const token = cardTokens.get(ctx.match[1]);
  if (!b || !owner || !token) return ctx.answerCallbackQuery({ text: "This card has expired. Ask again.", show_alert: true });
  cardTokens.delete(ctx.match[1]);
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  try {
    const message = await confirmCard(b.bdb, owner, token);
    await ctx.answerCallbackQuery({ text: "Done." });
    await ctx.reply(message);
  } catch (e) {
    await ctx.answerCallbackQuery({ text: friendlyError(e).slice(0, 190), show_alert: true });
  }
});

async function sendAlerts() {
  for (const id of await allBusinessIds(db())) {
    const bdb = scoped(db(), id);
    const link = await linkedChat(bdb);
    if (!link) continue;
    for (const a of await pendingAlerts(bdb)) {
      await bot.api.sendMessage(link.chatId, a.text, a.approveItemId ? { reply_markup: new InlineKeyboard().text("✅ OK, pay it", `ok:${a.approveItemId}`) } : undefined);
      await markSent(bdb, a.key); // after sending: a crash in between re-sends once, never skips
    }
  }
}

const me = await bot.api.getMe();
await db().setting.upsert({ where: { key: BOT_NAME }, create: { key: BOT_NAME, value: JSON.stringify(me.username) }, update: { value: JSON.stringify(me.username) } });
console.log(`Bursr bot @${me.username} running. Ctrl+C to stop.`);
setInterval(() => void sendAlerts().catch((e) => console.error("alerts:", e instanceof Error ? e.message : e)), 20_000);
await bot.start();
