// npm run bot: Bursar's Telegram bot (P1). Long polling; needs TELEGRAM_BOT_TOKEN.
//   /link CODE  connect this chat (code from Rules & account → Connect Telegram)
//   /plan       this week's plan, with an Approve button
// Alerts (blocked/held invoices, failed payments, refused attempts) go to the
// linked chat once each. Approving here is the same owner action as on the web.
import "./load-env";
import { Bot, InlineKeyboard } from "grammy";
import { agentAccount } from "../lib/agent-account";
import { db } from "../lib/db";
import { readEnv } from "../lib/env";
import { approvePlan } from "../lib/owner-actions";
import { payApprovedPlan } from "../lib/pay";
import { getLatestPlan, getPlan } from "../lib/plans";
import { BOT_NAME, linkChat, linkedChat, markSent, ownerForChat, pendingAlerts, planText } from "../lib/telegram";

const env = readEnv();
if (!env.TELEGRAM_BOT_TOKEN) throw new Error("Set TELEGRAM_BOT_TOKEN in .env (from @BotFather).");
const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
const web = env.NEXT_PUBLIC_APP_URL;

bot.command("start", (ctx) =>
  ctx.reply(
    "Hi, I'm Bursar. I check your supplier invoices for fraud and pay everyone once you approve.\n\n" +
      "To connect: open Bursar → Spending rules → Connect my Telegram, then send me the /link line it shows you.",
  ),
);

bot.command("link", async (ctx) => {
  await ctx.reply(await linkChat(db(), ctx.chat.id, ctx.match ?? ""));
});

bot.command("plan", async (ctx) => {
  if (!(await ownerForChat(db(), ctx.chat.id))) return ctx.reply("This chat isn't connected yet. Send /start to see how.");
  const plan = await getLatestPlan(db());
  if (!plan) return ctx.reply(`Nothing waiting yet. Get this week's payments ready at ${web}/payments`);
  const keyboard = plan.status === "draft" ? new InlineKeyboard().text("✅ Approve and pay everyone", `approve:${plan.id}`) : undefined;
  await ctx.reply(`${planText(plan)}\n\nSee the details: ${web}/payments`, { reply_markup: keyboard });
});

bot.callbackQuery(/^approve:(.+)$/, async (ctx) => {
  const owner = ctx.chat ? await ownerForChat(db(), ctx.chat.id) : null;
  if (!owner) return ctx.answerCallbackQuery({ text: "This chat isn't connected.", show_alert: true });
  const planId = ctx.match[1];
  try {
    await approvePlan(db(), owner, planId);
  } catch (e) {
    return ctx.answerCallbackQuery({ text: e instanceof Error ? e.message.slice(0, 190) : "Could not approve.", show_alert: true });
  }
  await ctx.answerCallbackQuery({ text: "Approved. Paying everyone now…" });
  await ctx.editMessageReplyMarkup({ reply_markup: undefined });
  const results = await payApprovedPlan(db(), await agentAccount(db()), planId);
  const sent = Object.values(results).filter((s) => s === "sent").length;
  const failed = Object.values(results).length - sent;
  await ctx.reply(`Done. ${sent} payments on the way${failed ? `, ${failed} not paid (see why below)` : ""}.\n\n${planText((await getPlan(db(), planId))!)}`);
});

async function sendAlerts() {
  const link = await linkedChat(db());
  if (!link) return;
  for (const a of await pendingAlerts(db())) {
    await bot.api.sendMessage(link.chatId, a.text);
    await markSent(db(), a.key); // after sending: a crash in between re-sends once, never skips
  }
}

const me = await bot.api.getMe();
await db().setting.upsert({ where: { key: BOT_NAME }, create: { key: BOT_NAME, value: JSON.stringify(me.username) }, update: { value: JSON.stringify(me.username) } });
console.log(`Bursar bot @${me.username} running. Ctrl+C to stop.`);
setInterval(() => void sendAlerts().catch((e) => console.error("alerts:", e instanceof Error ? e.message : e)), 20_000);
await bot.start();
