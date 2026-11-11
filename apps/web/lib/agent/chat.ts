import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { z } from "zod";
import { agentAccount } from "../agent-account";
import type { PrismaClient } from "../generated/prisma/client";
import { readEnv } from "../env";
import { listInvoices } from "../invoices";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "../money";
import { openPayload, sealPayload, type OwnerSession } from "../owner";
import { createInvite } from "../invites";
import { requestOneOffPayment, setFrozen } from "../owner-actions";
import type { quotePayout } from "../quotes";
import { scheduleWords } from "../schedule";
import { getBusiness, listPayees } from "../store";
import { chainName } from "../tokens";
import { runAgent } from "./engine";
import { comingUp, needsYou, nextPayday } from "./view";

// Talking to Bursar's agent. The model (on NEAR AI Cloud, inside a TEE) can
// read the business's data through tools and can PROPOSE actions; every
// action becomes a card the owner confirms. It cannot add payees or change
// rules, and an amount is only accepted if the owner wrote it in their own
// message ("never invent amounts").

export const DEFAULT_CHAT_MODEL = "Qwen/Qwen3.6-35B-A3B-FP8";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type CardAction =
  | { kind: "pay"; payeeId: string; payeeName: string; amountUsd: string; note: string }
  /** Someone not on the list yet: a link for them to fill in; the agent pays once the owner approves them. */
  | { kind: "pay_new"; name: string; amountUsd: string; note: string }
  | { kind: "run_payday" }
  | { kind: "pause"; pause: boolean };

export interface ActionCard {
  token: string;
  title: string;
  detail: string;
  confirm: string;
}

export interface ChatReply {
  reply: string;
  cards: ActionCard[];
  /** The answer came from the model on NEAR AI Cloud (false: built-in answers, no key). */
  ai: boolean;
}

const CARD_TTL_MS = 15 * 60_000;
const DAY = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

function card(action: CardAction, owner: OwnerSession): ActionCard {
  const token = sealPayload({ action, owner: owner.accountId }, CARD_TTL_MS);
  if (action.kind === "pay") {
    return { token, title: `Pay ${action.payeeName} ${formatUsd(BigInt(action.amountUsd))}`, detail: action.note || "One-off payment", confirm: "Yes, pay it" };
  }
  if (action.kind === "pay_new") {
    return {
      token,
      title: `Pay ${action.name} ${formatUsd(BigInt(action.amountUsd))} once`,
      detail: `${action.note || "One-time job"}. ${action.name} isn't on your list yet: this makes a link for them to say where to be paid. You approve their details, then I pay them and take them off the list.`,
      confirm: "Make their link",
    };
  }
  if (action.kind === "run_payday") return { token, title: "Run payday now", detail: "Pay everything due by the coming payday (routine payments go out at once).", confirm: "Run it" };
  return { token, title: action.pause ? "Pause all payments" : "Turn payments back on", detail: action.pause ? "Nothing goes out until you turn payments back on." : "The agent picks up anything that was waiting.", confirm: action.pause ? "Pause" : "Turn on" };
}

/** True when the owner's message contains this amount ("$20", "20", "1,250.50"), not just a number that starts the same. */
export function ownerWroteAmount(message: string, amount: string): boolean {
  const said = message.replace(/(\d),(\d)/g, "$1$2");
  const n = Number(amount);
  return (said.match(/\d+(?:\.\d+)?/g) ?? []).some((x) => Number(x) === n);
}

// --- tools -------------------------------------------------------------------

const TOOLS: ChatCompletionTool[] = [
  { type: "function", function: { name: "get_overview", description: "Money in the Bursar wallet, what is left of the weekly limit, the limits, autopilot, paused or not, the next payday and what it needs.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_people", description: "Everyone the business pays: name, type, how and on which network they are paid, and their regular pay schedule.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "recent_payments", description: "The most recent payments the agent made or tried, with status and reason.", parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 30 } } } } },
  { type: "function", function: { name: "coming_up", description: "Payments the agent will make over the next two weeks, with their dates.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_invoices", description: "Supplier invoices Bursar has read, with their check results and reasons.", parameters: { type: "object", properties: { only_problems: { type: "boolean" } } } } },
  { type: "function", function: { name: "needs_you", description: "Things waiting for the owner: payments to OK, payments that failed, money needed.", parameters: { type: "object", properties: {} } } },
  {
    type: "function",
    function: {
      name: "propose_payment",
      description:
        "Propose a one-off payment to someone ALREADY on the owner's list. Only when the owner asked for it and wrote the amount themselves. Creates a confirmation card; nothing is paid until the owner confirms.",
      parameters: {
        type: "object",
        properties: { payee_name: { type: "string" }, amount_usd: { type: "string", description: "Exactly as the owner wrote it, e.g. 20 or 20.50" }, note: { type: "string" } },
        required: ["payee_name", "amount_usd"],
      },
    },
  },
  { type: "function", function: { name: "propose_run_payday", description: "Propose running payday now (pay everything due by the coming payday). Creates a confirmation card.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "propose_pause", description: "Propose pausing all payments (pause=true) or turning them back on (pause=false). Creates a confirmation card.", parameters: { type: "object", properties: { pause: { type: "boolean" } }, required: ["pause"] } } },
];

interface ToolContext {
  db: PrismaClient;
  owner: OwnerSession;
  lastUserMessage: string;
  cards: ActionCard[];
  live: boolean;
}

async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<unknown> {
  const { db } = ctx;
  const args = (() => {
    try {
      return JSON.parse(rawArgs || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const business = (await getBusiness(db))!;
  const rules = business.rules;
  switch (name) {
    case "get_overview": {
      const status = await (await agentAccount(db)).status().catch(() => null);
      const t = rules.treasury;
      const held = status ? rescale(status.balances[t.assetId] ?? 0n, t.decimals, USD_DECIMALS) : null;
      const payday = nextPayday(new Date(), rules.timeZone, rules.paydayWeekday);
      const due = (await comingUp(db)).filter((u) => u.dueOn <= payday).reduce((a, u) => a + u.amountUsd, 0n);
      const spent = status?.spentThisWeekUsd ?? 0n;
      return {
        business: business.name,
        bursar_wallet: held === null ? "unknown" : formatUsd(held),
        weekly_limit: formatUsd(BigInt(rules.weeklyCapUsd)),
        left_this_week: formatUsd(BigInt(rules.weeklyCapUsd) > spent ? BigInt(rules.weeklyCapUsd) - spent : 0n),
        largest_single_payment: formatUsd(BigInt(rules.perPaymentCapUsd)),
        ask_owner_above: formatUsd(BigInt(rules.approvalThresholdUsd)),
        autopilot: rules.autopilot,
        paused: rules.frozen,
        next_payday: DAY(payday),
        due_by_next_payday: formatUsd(due),
        mode: ctx.live ? "live (real money)" : "practice (practice money)",
      };
    }
    case "list_people":
      return (await listPayees(db)).map((p) => ({
        name: p.name,
        type: p.category,
        paid_in: `${p.payout.token.symbol} on ${chainName(p.payout.token.chain)}`,
        regular_pay: p.recurring ? `${formatUsd(BigInt(p.recurring.amountUsd))} ${scheduleWords(p.recurring, rules.paydayWeekday)}` : null,
        first_payment_needs_owner: !p.trustedAt,
      }));
    case "recent_payments": {
      const limit = Math.min(30, Math.max(1, Number(args.limit) || 10));
      const rows = await db.planItem.findMany({ where: { placement: "in", plan: { status: { not: "draft" } } }, orderBy: { id: "desc" }, take: limit });
      return rows.map((r) => ({ to: r.payeeName, for: r.forWhat, amount: formatUsd(BigInt(r.amountUsd)), status: r.payStatus, reason: r.payReason, sent: r.sentAt?.toISOString().slice(0, 16) ?? null }));
    }
    case "coming_up":
      return (await comingUp(db)).map((u) => ({ on: DAY(u.dueOn), to: u.payeeName, for: u.forWhat, amount: formatUsd(u.amountUsd) }));
    case "list_invoices": {
      const all = await listInvoices(db);
      const pick = args.only_problems ? all.filter((i) => !["ready", "flag"].includes(i.status)) : all;
      return pick.slice(0, 20).map((i) => ({
        supplier: i.supplierName,
        number: i.invoiceNumber,
        amount: formatUsd(i.totalUsd),
        status: i.status,
        reasons: i.results.filter((r) => r.status !== "pass").map((r) => r.reason),
      }));
    }
    case "needs_you":
      return (await needsYou(db)).map((n) => ({ what: n.kind, to: n.payeeName, for: n.forWhat, amount: formatUsd(n.amountUsd), why: n.reason }));
    case "propose_payment": {
      const amountText = String(args.amount_usd ?? "").replace(/[$,\s]/g, "");
      if (!/^\d+(\.\d{1,2})?$/.test(amountText)) return { error: "Ask the owner for the exact amount." };
      // Never invent amounts: the number must be in the owner's own words.
      if (!ownerWroteAmount(ctx.lastUserMessage, amountText)) {
        return { error: `The owner didn't write ${amountText} in their message. Ask them to confirm the amount; do not guess.` };
      }
      const wanted = String(args.payee_name ?? "").toLowerCase().trim();
      const people = await listPayees(db);
      const matches = people.filter((p) => p.name.toLowerCase().includes(wanted) || wanted.includes(p.name.toLowerCase().split(" ")[0]));
      const amountUsd = parseUnits(amountText, USD_DECIMALS);
      if (matches.length > 1) return { error: `Several people match: ${matches.map((m) => m.name).join(", ")}. Ask which one.` };
      if (matches.length === 0) {
        // Someone new: offer a one-time payment by link (the owner still approves them before anything is paid).
        const name = String(args.payee_name ?? "").trim().slice(0, 80);
        if (!name) return { error: "Ask the owner who to pay." };
        ctx.cards.push(card({ kind: "pay_new", name, amountUsd: amountUsd.toString(), note: String(args.note ?? "").slice(0, 80) }, ctx.owner));
        return { card: "shown to the owner", note: `${name} isn't on the list yet. The card makes a link for them to fill in; the owner approves their details, then the payment goes out and they come off the list.` };
      }
      ctx.cards.push(card({ kind: "pay", payeeId: matches[0].id, payeeName: matches[0].name, amountUsd: amountUsd.toString(), note: String(args.note ?? "").slice(0, 80) }, ctx.owner));
      return { card: "shown to the owner", payee: matches[0].name, amount: formatUsd(amountUsd), note: "Tell the owner to confirm the card. Nothing is paid until they do." };
    }
    case "propose_run_payday":
      ctx.cards.push(card({ kind: "run_payday" }, ctx.owner));
      return { card: "shown to the owner" };
    case "propose_pause": {
      if (ctx.live) return { info: "In live mode pausing is confirmed in the owner's own wallet: send them to Spending rules → Pause all payments." };
      ctx.cards.push(card({ kind: "pause", pause: Boolean(args.pause) }, ctx.owner));
      return { card: "shown to the owner" };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

// --- the conversation --------------------------------------------------------

function systemPrompt(businessName: string, live: boolean) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return [
    `You are Bursar's agent for ${businessName}, a small business. You pay its staff and suppliers in digital dollars (stablecoins) inside limits the owner set. Today is ${today}. Mode: ${live ? "live, real money" : "practice money"}.`,
    "Talk to the owner in short, plain sentences. Plain text only: no markdown, no ** or #; use • for lists. No crypto jargon unless they use it. Use the tools to look things up; never guess numbers, names or dates.",
    "You can propose actions (a one-off payment to someone already on their list, running payday, pausing). Each becomes a card the owner confirms; say so.",
    "Never invent an amount: only propose a payment when the owner wrote the amount. You cannot add people, change where someone is paid, or change limits; point the owner to the People or Spending rules page for that.",
    "The wallet itself enforces the limits; you cannot go around them.",
  ].join("\n");
}

const QUICK: Record<string, (ctx: ToolContext) => Promise<string>> = {
  "What did you pay this week?": async (ctx) => {
    const rows = (await runTool("recent_payments", '{"limit":10}', ctx)) as { to: string; amount: string; status: string; for: string }[];
    return rows.length ? rows.map((r) => `• ${r.to}: ${r.amount} (${r.for}), ${r.status}`).join("\n") : "I haven't paid anyone yet.";
  },
  "What's coming up?": async (ctx) => {
    const rows = (await runTool("coming_up", "{}", ctx)) as { on: string; to: string; amount: string; for: string }[];
    return rows.length ? rows.slice(0, 10).map((r) => `• ${r.on}: ${r.to}, ${r.amount} (${r.for})`).join("\n") : "Nothing is due in the next two weeks.";
  },
  "Which invoices are on hold, and why?": async (ctx) => {
    const rows = (await runTool("list_invoices", '{"only_problems":true}', ctx)) as { supplier: string; number: string; amount: string; reasons: string[] }[];
    return rows.length ? rows.map((r) => `• ${r.supplier} #${r.number} (${r.amount}): ${r.reasons.join(" ")}`).join("\n") : "No invoices are on hold.";
  },
  "How much is left this week?": async (ctx) => {
    const o = (await runTool("get_overview", "{}", ctx)) as Record<string, string>;
    return `You have ${o.left_this_week} left of your ${o.weekly_limit} weekly limit, and ${o.bursar_wallet} in your Bursar wallet. Next payday is ${o.next_payday} and needs ${o.due_by_next_payday}.`;
  },
  "Run payday now": async (ctx) => {
    await runTool("propose_run_payday", "{}", ctx);
    return "Here you go. Confirm and I'll pay everything due by the coming payday.";
  },
};
export const QUICK_QUESTIONS = Object.keys(QUICK);

export async function chat(db: PrismaClient, owner: OwnerSession, history: ChatTurn[]): Promise<ChatReply> {
  const env = readEnv();
  const business = await getBusiness(db);
  if (!business) return { reply: "Set up your business first.", cards: [], ai: false };
  const last = history.filter((h) => h.role === "user").at(-1)?.content.trim() ?? "";
  const ctx: ToolContext = { db, owner, lastUserMessage: last, cards: [], live: env.BURSAR_MODE === "live" };

  if (!env.NEAR_AI_API_KEY) {
    const quick = QUICK[last];
    const reply = quick
      ? await quick(ctx)
      : "Free chat needs a NEAR AI key (NEAR_AI_API_KEY in .env). Without one I can answer these: " + QUICK_QUESTIONS.join(" · ");
    return { reply, cards: ctx.cards, ai: false };
  }

  const client = new OpenAI({ baseURL: env.NEAR_AI_BASE_URL, apiKey: env.NEAR_AI_API_KEY, timeout: 60_000, maxRetries: 1 });
  const model = env.NEAR_AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL;
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(business.name, ctx.live) },
    ...history.slice(-12).map((h) => ({ role: h.role, content: h.content.slice(0, 2000) }) as ChatCompletionMessageParam),
  ];
  for (let step = 0; step < 6; step++) {
    const res = await client.chat.completions.create({ model, messages, tools: TOOLS, tool_choice: "auto", temperature: 0.2, max_tokens: 700 });
    const msg = res.choices[0]?.message;
    if (!msg) break;
    const calls = msg.tool_calls?.filter((c) => c.type === "function") ?? [];
    if (calls.length === 0) {
      const text = (msg.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (text) return { reply: text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, ""), cards: ctx.cards, ai: true };
      // Some turns end after a tool call with no words: ask once more for the answer itself.
      messages.push({ role: "user", content: "Please answer my question in plain words, using what you just looked up." });
      continue;
    }
    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
    for (const c of calls) {
      const out = await runTool(c.function.name, c.function.arguments, ctx).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out).slice(0, 6000) });
    }
  }
  return { reply: "I couldn't finish that. Could you ask it another way?", cards: ctx.cards, ai: true };
}

// --- confirming a card -------------------------------------------------------

const CardPayload = z.object({ owner: z.string(), action: z.any() });

export async function confirmCard(db: PrismaClient, owner: OwnerSession, token: string, quote?: typeof quotePayout): Promise<string> {
  const payload = CardPayload.safeParse(openPayload(token));
  if (!payload.success) throw new Error("This card has expired. Ask again.");
  if (payload.data.owner !== owner.accountId) throw new Error("This card was made for someone else.");
  const action = payload.data.action as CardAction;
  if (action.kind === "pay") {
    await requestOneOffPayment(db, owner, { payeeId: action.payeeId, amountUsd: BigInt(action.amountUsd), note: action.note || "One-off payment" });
    const r = await runAgent(db, { quote });
    return r.sent ? `Paying ${action.payeeName} now. You'll see it arrive in the feed.` : `Asked the agent to pay ${action.payeeName}. Watch the feed for how it goes.`;
  }
  if (action.kind === "pay_new") {
    const invite = await createInvite(db, owner, { name: action.name, category: "supplier", recurring: null, oneOff: { amountUsd: action.amountUsd, note: action.note || "One-time job", removeAfterPaid: true } });
    const link = `${readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/join/${invite.token}`;
    return `Send ${invite.name} this link: ${link} When they've sent their details, approve them on People${readEnv().BURSAR_MODE === "live" ? " and confirm with your wallet" : ""}, and I'll pay them ${formatUsd(BigInt(action.amountUsd))} straight away.`;
  }
  if (action.kind === "run_payday") {
    const r = await runAgent(db, { dueBy: "payday", quote });
    return r.newPayments || r.attempted ? `The agent is paying ${r.attempted} payment${r.attempted === 1 ? "" : "s"}; ${r.needsOwner} need your OK.` : "Nothing is due yet.";
  }
  if (readEnv().BURSAR_MODE === "live") throw new Error("In live mode, pause from Spending rules: your wallet confirms it.");
  await setFrozen(db, owner, action.pause);
  return action.pause ? "All payments are paused." : "Payments are back on.";
}
