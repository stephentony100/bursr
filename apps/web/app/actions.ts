"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { verifyReader, type AttestationResult } from "@/lib/attestation";
import { aiSummary, monthFacts, type AiSummary } from "@/lib/summary";
import { BOT_NAME, createLinkCode } from "@/lib/telegram";
import { agentAccount, type ActionRequest } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { clearPracticeBusiness, loadSampleBusiness, loadSampleInvoices } from "@/lib/demo-loader";
import { ingestInvoice } from "@/lib/invoices";
import { demoEvmAddress, demoNearImplicit, demoTronAddress } from "@/lib/demo-addresses";
import { PayeeCategory, type Payout, type PriceItem } from "@/lib/domain";
import { addPracticeMoney, depositAddress, oneTapDeposit, type DepositAddress, type OneTapDeposit } from "@/lib/funding";
import { readEnv } from "@/lib/env";
import { approveInvite, createInvite, declineInvite, submitInvite } from "@/lib/invites";
import { clearOnboarding, markOnboarding } from "@/lib/onboarding";
import { starterRules } from "@/lib/starter-rules";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "@/lib/money";
import {
  addPayee,
  approvePlan,
  approvePlanItem,
  NotOwnerError,
  setupBusiness,
  changePayout,
  removePayee,
  removePlanItem,
  setFrozen,
  updatePayeeDetails,
  updateRules,
} from "@/lib/owner-actions";
import { chat, confirmCard, type ChatReply, type ChatTurn } from "@/lib/agent/chat";
import { runAgent } from "@/lib/agent/engine";
import { followPayments, kickAgent } from "@/lib/agent/loop";
import { payApprovedPlan } from "@/lib/pay";
import { prepareWeeklyPlan } from "@/lib/plans";
import { requireOwner } from "@/lib/session";
import { getBusiness, getPayee, listPayees } from "@/lib/store";
import { payoutTokens } from "@/lib/tokens";

// Every action is an untrusted entry point: each one resolves the owner from
// the session itself and validates its input. Owner-only changes go through
// lib/owner-actions.ts, which checks the owner again.

export type FormResult = { ok: boolean; message: string } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function dollars(f: FormData, k: string, label: string): string {
  const v = text(f, k).replace(/^\$/, "");
  try {
    return parseUnits(v, USD_DECIMALS).toString();
  } catch {
    throw new Error(`${label}: please enter an amount like 250 or 250.50`);
  }
}

async function run(fn: () => Promise<string>): Promise<FormResult> {
  try {
    const message = await fn();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function loadSample(): Promise<FormResult> {
  return run(async () => {
    await loadSampleBusiness(db());
    kickAgent();
    return "Welcome to Bukka Corner. Have a look around.";
  });
}

export async function saveRules(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const owner = await requireOwner();
    const business = await getBusiness(db());
    if (!business) throw new Error("Set up the business first.");
    const allowed = new Set(f.getAll("payoutToken").map(String));
    const all = await payoutTokens();
    const chosen = all.filter((t) => allowed.has(t.assetId));
    if (chosen.length === 0) throw new Error("Pick at least one way to pay people.");
    const inUse = (await listPayees(db())).filter((p) => !allowed.has(p.payout.token.assetId));
    if (inUse.length) throw new Error(`${inUse[0].name} is paid that way, so it has to stay ticked. Change how they're paid first.`);
    await updateRules(db(), owner, {
      ...business.rules,
      weeklyCapUsd: dollars(f, "weeklyCap", "Weekly limit"),
      perPaymentCapUsd: dollars(f, "perPaymentCap", "Largest single payment"),
      approvalThresholdUsd: dollars(f, "approvalThreshold", "Ask me first above"),
      paydayWeekday: Number(text(f, "payday")),
      payoutTokens: chosen,
      autopilot: f.get("autopilot") === "on",
      invoiceTiming: text(f, "invoiceTiming") === "asap" ? "asap" : "due",
    });
    kickAgent();
    return readEnv().BURSAR_MODE === "dry-run" ? "Saved. Your new limits apply straight away." : "Saved. Now confirm them with your wallet above so they take effect.";
  });
}

export async function toggleFreeze(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    if (readEnv().BURSAR_MODE !== "dry-run") throw new Error("Pause payments from the wallet box above; it asks your wallet to confirm.");
    const freeze = text(f, "freeze") === "1";
    await setFrozen(db(), await requireOwner(), freeze);
    return freeze ? "All payments are paused. Nothing can go out until you turn them back on." : "Payments are back on.";
  });
}

function parsePrices(raw: string): PriceItem[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.+?)\s*[=:]\s*\$?\s*(\d+(?:\.\d{1,2})?)$/.exec(line);
      if (!m) throw new Error(`Agreed prices: please write each line like "Tomatoes (crate) = 18.00". This line didn't fit: "${line}"`);
      return { item: m[1], unitPriceUsd: parseUnits(m[2], USD_DECIMALS).toString(), toleranceBps: 500 };
    });
}

async function payoutFrom(f: FormData): Promise<Payout> {
  const business = await getBusiness(db());
  if (!business) throw new Error("Set up the business first.");
  const token = business.rules.payoutTokens.find((t) => t.assetId === text(f, "token"));
  if (!token) throw new Error("Pick how they want to be paid.");
  const address = text(f, "address");
  if (!address) throw new Error("Add their wallet address.");
  return { token, address, memo: text(f, "memo") || null };
}

function recurringFrom(f: FormData) {
  const amount = text(f, "recurringAmount");
  if (!amount) return null;
  const every = text(f, "recurringEvery");
  const amountUsd = dollars(f, "recurringAmount", "Regular pay");
  if (every === "two_weeks") return { amountUsd, every: "two_weeks" as const };
  if (every === "month") {
    const day = text(f, "recurringDay");
    return day === "" ? { amountUsd, every: "month" as const } : { amountUsd, every: "month" as const, day: Math.min(28, Math.max(0, Number(day) || 0)) };
  }
  return { amountUsd, every: "week" as const };
}

export async function addPayeeAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const name = text(f, "name");
    if (!name) throw new Error("Add their name.");
    await addPayee(db(), await requireOwner(), {
      name,
      category: PayeeCategory.parse(text(f, "category")),
      payout: await payoutFrom(f),
      prices: parsePrices(text(f, "prices")),
      recurring: recurringFrom(f),
    });
    return `${name} added. You can now pay them.`;
  });
}

export async function updatePayeeAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const id = text(f, "id");
    await updatePayeeDetails(db(), await requireOwner(), id, {
      name: text(f, "name"),
      category: PayeeCategory.parse(text(f, "category")),
      prices: parsePrices(text(f, "prices")),
      recurring: recurringFrom(f),
    });
    return "Saved.";
  });
}

export async function changePayoutAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const id = text(f, "id");
    const payee = await getPayee(db(), id);
    if (!payee) throw new Error("Payee not found.");
    await changePayout(db(), await requireOwner(), id, await payoutFrom(f));
    return `Saved. For your safety, payments to ${payee.name} are on hold for 48 hours.`;
  });
}

export async function removePayeeAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await removePayee(db(), await requireOwner(), text(f, "id"));
    return "Removed. Bursar can no longer pay them.";
  });
}

export type RuleTestResult = { tried: string; allowed: boolean; message: string } | null;

/**
 * "Test the rules": asks the agent account what it would do with a payment,
 * moving nothing. The answer comes from the account (the simulator in
 * dry-run, the Agent API in live mode), not from this page.
 */
export async function testRule(_prev: RuleTestResult, f: FormData): Promise<RuleTestResult> {
  const business = await getBusiness(db());
  const payees = await listPayees(db());
  if (!business) return { tried: "", allowed: false, message: "Add someone you pay first." };
  // Prefer a supplier paid in the token the account holds, so only the rule under test decides
  // (paying in another token needs a swap first, which the payment run does).
  const inTreasury = payees.filter((p) => p.payout.token.assetId === business.rules.treasury.assetId);
  const payee = inTreasury.find((p) => p.category === "supplier") ?? inTreasury[0] ?? payees[0];
  if (!payee) return { tried: "", allowed: false, message: "Add someone you pay first." };
  const token = payee.payout.token;
  const amountFor = (micros: bigint) => rescale(micros, USD_DECIMALS, token.decimals);
  const cap = BigInt(business.rules.perPaymentCapUsd);

  const scenario = text(f, "scenario");
  let req: ActionRequest;
  let tried: string;
  const base = { kind: "withdraw" as const, asset: token.assetId, chain: token.chain, memo: payee.payout.memo };
  if (scenario === "over_cap") {
    const over = cap + parseUnits("1", USD_DECIMALS);
    req = { ...base, amount: amountFor(over), recipient: payee.payout.address };
    tried = `pay ${payee.name} ${formatUsd(over)}, $1 more than your limit for a single payment`;
  } else if (scenario === "stranger") {
    const addr = token.chain === "tron" ? demoTronAddress("not-a-payee") : token.chain === "near" ? demoNearImplicit("not-a-payee") : demoEvmAddress("not-a-payee");
    req = { ...base, amount: amountFor(parseUnits("50", USD_DECIMALS)), recipient: addr };
    tried = `pay $50.00 to a wallet that isn't one of the people you pay`;
  } else {
    req = { ...base, amount: amountFor(parseUnits("50", USD_DECIMALS)), recipient: payee.payout.address };
    tried = `pay ${payee.name} $50.00`;
  }
  try {
    const out = await (await agentAccount(db())).preview(req);
    return out.status === "refused"
      ? { tried, allowed: false, message: out.refusal.message }
      : { tried, allowed: true, message: "This would go through, just as it should." };
  } catch (e) {
    return { tried, allowed: false, message: e instanceof Error ? e.message : "Bursar couldn't reach your wallet just now. Please try again." };
  }
}

const MAX_UPLOAD = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "text/plain"]);

/** An invoice photo or pasted text goes through the Reader and every check. */
export async function uploadInvoiceAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await requireOwner();
    const file = f.get("file");
    const pasted = text(f, "pasted");
    let input: { name: string; mediaType: string; bytes: Buffer };
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD) throw new Error("That file is a bit big (over 4 MB). Please send a smaller photo.");
      if (!ALLOWED_TYPES.has(file.type)) throw new Error("Bursar reads photos and screenshots (PNG, JPG, WebP) or pasted text. For a PDF, send a screenshot of it.");
      input = { name: file.name, mediaType: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
    } else if (pasted) {
      input = { name: "pasted text", mediaType: "text/plain", bytes: Buffer.from(pasted.slice(0, 20_000), "utf8") };
    } else {
      throw new Error("Add a photo of the invoice or paste its text.");
    }
    const v = await ingestInvoice(db(), input);
    kickAgent();
    const label = v.supplierName ? `${v.supplierName} #${v.invoiceNumber}` : input.name;
    const words: Record<string, string> = {
      ready: "looks good and is ready to pay",
      flag: "is ready to pay, but read the note",
      defer: "moves to next week",
      hold: "is on hold until you check it",
      block: "is blocked. Don't pay it",
      needs_owner: "needs your eyes",
    };
    return `${label} ${words[v.status] ?? v.status}.`;
  });
}

export async function loadSampleInvoicesAction(): Promise<FormResult> {
  return run(async () => {
    if (readEnv().BURSAR_MODE !== "dry-run") throw new Error("Sample invoices are for practice mode only.");
    await requireOwner();
    await db().invoice.deleteMany();
    await loadSampleInvoices(db());
    return "The six sample invoices were checked again.";
  });
}

// --- The weekly plan ---------------------------------------------------------

export async function preparePlanAction(): Promise<FormResult> {
  return run(async () => {
    await requireOwner();
    const plan = await prepareWeeklyPlan(db());
    const n = plan.items.filter((i) => i.placement === "in").length;
    return `Ready: ${n} payment${n === 1 ? "" : "s"} waiting for your OK.`;
  });
}

export async function approveItemAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await approvePlanItem(db(), await requireOwner(), text(f, "itemId"));
    kickAgent();
    return "OK'd. The agent is paying it now.";
  });
}

export async function removeItemAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await removePlanItem(db(), await requireOwner(), text(f, "itemId"));
    return "Taken out of this week's payments.";
  });
}

/** One tap: approve the whole plan, then pay it through the agent account. */
export async function approvePlanAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const planId = text(f, "planId");
    await approvePlan(db(), await requireOwner(), planId);
    const results = await payApprovedPlan(db(), await agentAccount(db()), planId);
    const sent = Object.values(results).filter((s) => s === "sent").length;
    const failed = Object.values(results).filter((s) => s === "failed").length;
    return `Done. ${sent} payment${sent === 1 ? "" : "s"} on the way${failed ? `, ${failed} not paid (see why below)` : ""}.`;
  });
}

/**
 * PRD §9 step 6: try to push one payment above the per-payment cap straight to
 * the account, bypassing the plan. The account must refuse. Practice mode
 * sends the request to the simulated account; live mode only previews it
 * (a refused live request is recorded by `npm run rules:live`).
 */
export async function forceOverCapAction(): Promise<RuleTestResult> {
  const business = await getBusiness(db());
  const payees = await listPayees(db());
  if (!business) return { tried: "", allowed: false, message: "Set up the business first." };
  const payee = payees.find((p) => p.payout.token.assetId === business.rules.treasury.assetId) ?? payees[0];
  if (!payee) return { tried: "", allowed: false, message: "Add a payee first." };
  const over = BigInt(business.rules.perPaymentCapUsd) + parseUnits("1", USD_DECIMALS);
  const token = payee.payout.token;
  const req: ActionRequest = {
    kind: "withdraw",
    asset: token.assetId,
    amount: rescale(over, USD_DECIMALS, token.decimals),
    chain: token.chain,
    recipient: payee.payout.address,
    memo: payee.payout.memo,
  };
  const tried = `send ${formatUsd(over)} to ${payee.name}, skipping your approval`;
  try {
    const account = await agentAccount(db());
    const out = readEnv().BURSAR_MODE === "dry-run" ? await account.execute(req, `forced-${Date.now()}`) : await account.preview(req);
    revalidatePath("/", "layout");
    return out.status === "refused"
      ? { tried, allowed: false, message: out.refusal.message }
      : { tried, allowed: true, message: "It went through. Please check your spending rules: this should not happen." };
  } catch (e) {
    return { tried, allowed: false, message: e instanceof Error ? e.message : "Bursar couldn't reach your wallet just now. Please try again." };
  }
}

/** Runs the NEAR AI Cloud TEE verification (docs' steps) with a fresh nonce. Needs no key. */
export async function verifyReaderAction(): Promise<AttestationResult> {
  return verifyReader();
}

/** NEAR AI phrases this month's facts; rejected if it mentions any figure not in the records. */
export async function aiSummaryAction(): Promise<AiSummary> {
  return aiSummary(await monthFacts(db()));
}

/** Owner only: a one-time code to link the owner's Telegram chat to the bot. */
export async function telegramLinkAction(): Promise<FormResult> {
  return run(async () => {
    const code = await createLinkCode(db(), await requireOwner());
    const row = await db().setting.findUnique({ where: { key: BOT_NAME } });
    const name = row ? `@${JSON.parse(row.value)}` : "your Bursar bot (start it with npm run bot)";
    return `Open ${name} in Telegram and send:  /link ${code}  (valid for 10 minutes)`;
  });
}

/** "Run payday now": the agent pays everything due by the coming payday, right away (routine ones), and reports. */
export async function runPaydayNowAction(): Promise<FormResult> {
  return run(async () => {
    await requireOwner();
    const r = await runAgent(db(), { dueBy: "payday" });
    followPayments();
    revalidatePath("/", "layout");
    if (!r.ran) return r.note ?? "The agent is busy; try again in a moment.";
    const parts = [
      r.sent ? `sent ${r.sent}` : "",
      r.waiting ? `${r.waiting} waiting (it will retry)` : "",
      r.needsOwner ? `${r.needsOwner} need your OK` : "",
      r.failed ? `${r.failed} need you` : "",
    ].filter(Boolean);
    return parts.length ? `The agent ${parts.join(", ")}. See what it did below.` : "Nothing is due yet. The agent will pay each payment on its day.";
  });
}

// --- Adding money to the agent's wallet --------------------------------------

export type DepositResult = { ok: true; address: DepositAddress; qrSvg: string } | { ok: false; message: string };

/** A one-time deposit address on another chain, with a QR code (live mode). */
export async function depositAddressAction(symbol: string, chain: string): Promise<DepositResult> {
  try {
    await requireOwner();
    if (readEnv().BURSAR_MODE === "dry-run") throw new Error("In practice mode, use \"Add practice money\".");
    const address = await depositAddress(db(), symbol, chain);
    const qrSvg = await QRCode.toString(address.address, { type: "svg", margin: 1, width: 192 });
    return { ok: true, address, qrSvg };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't get an address just now." };
  }
}

/** What the owner's NEAR wallet signs for a one-tap top-up (live mode). */
export async function oneTapDepositAction(): Promise<{ ok: true; deposit: OneTapDeposit } | { ok: false; message: string }> {
  try {
    const owner = await requireOwner();
    return { ok: true, deposit: await oneTapDeposit(db(), owner.accountId) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't prepare the top-up." };
  }
}

export async function practiceMoneyAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await requireOwner();
    if (readEnv().BURSAR_MODE !== "dry-run") throw new Error("Practice money is for practice mode only.");
    const amount = text(f, "amount") || "500";
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(amount)) throw new Error("Enter an amount like 500.");
    await addPracticeMoney(db(), amount);
    kickAgent();
    revalidatePath("/", "layout");
    return `Added $${amount} of practice money. The agent will use it for anything waiting.`;
  });
}

/** After the owner's wallet sent a one-tap top-up: wake the agent so it notices the money. */
export async function noticeTopUpAction(): Promise<void> {
  await requireOwner();
  kickAgent();
}

// --- Talking to the agent ----------------------------------------------------

export async function chatAction(history: ChatTurn[]): Promise<ChatReply> {
  try {
    const owner = await requireOwner();
    const clean = history
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
      .map((h) => ({ role: h.role, content: h.content.slice(0, 2000) }))
      .slice(-12);
    return await chat(db(), owner, clean);
  } catch (e) {
    return { reply: e instanceof Error ? e.message : "Something went wrong.", cards: [], ai: false };
  }
}

export async function confirmCardAction(token: string): Promise<FormResult> {
  return run(async () => {
    const message = await confirmCard(db(), await requireOwner(), token);
    followPayments();
    revalidatePath("/", "layout");
    return message;
  });
}

// --- Onboarding (/welcome) ----------------------------------------------------
// Each step saves and goes back to /welcome, which shows the next step.

async function step(fn: () => Promise<void>): Promise<FormResult> {
  try {
    await fn();
  } catch (e) {
    return { ok: false, message: e instanceof NotOwnerError ? e.message : e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/", "layout");
  redirect("/welcome");
}

const WANTED_NETWORKS: [string, string][] = [
  ["USDC", "near"],
  ["USDC", "base"],
  ["USDC", "sol"],
  ["USDT", "tron"],
  ["USDC", "sui"],
  ["USDC", "arb"],
  ["USDC", "eth"],
];

export async function onboardBusinessAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return step(async () => {
    const owner = await requireOwner();
    const name = text(f, "name");
    if (name.length < 2) throw new Error("Add your business name.");
    const timeZone = text(f, "timeZone") || "Africa/Lagos";
    try {
      new Intl.DateTimeFormat("en", { timeZone });
    } catch {
      throw new Error("Pick your time zone from the list.");
    }
    const tokens = await payoutTokens();
    const base = starterRules(tokens);
    const networks = WANTED_NETWORKS.map(([sym, chain]) => tokens.find((t) => t.symbol === sym && t.chain === chain)).filter((t): t is NonNullable<typeof t> => Boolean(t));
    const existing = await getBusiness(db());
    const rules = existing
      ? { ...existing.rules, timeZone, paydayWeekday: Number(text(f, "payday")) }
      : { ...base, timeZone, paydayWeekday: Number(text(f, "payday")), payoutTokens: networks.length ? networks : base.payoutTokens };
    await setupBusiness(db(), owner, { name: name.slice(0, 80), rules });
  });
}

export async function onboardLimitsAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return step(async () => {
    const owner = await requireOwner();
    const business = await getBusiness(db());
    if (!business) throw new Error("Add your business first.");
    const allowed = new Set(f.getAll("payoutToken").map(String));
    const chosen = (await payoutTokens()).filter((t) => allowed.has(t.assetId));
    if (chosen.length === 0) throw new Error("Pick at least one way to pay people.");
    await updateRules(db(), owner, {
      ...business.rules,
      weeklyCapUsd: dollars(f, "weeklyCap", "Weekly limit"),
      perPaymentCapUsd: dollars(f, "perPaymentCap", "Largest single payment"),
      approvalThresholdUsd: dollars(f, "approvalThreshold", "Ask me first above"),
      payoutTokens: chosen,
      autopilot: f.get("autopilot") === "on",
      invoiceTiming: text(f, "invoiceTiming") === "asap" ? "asap" : "due",
    });
    await markOnboarding(db(), "limits");
  });
}

/** Marks a skippable step as seen (people, money), the practice agent as on, or the whole flow as finished. */
export async function onboardNextAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  const what = text(f, "step");
  if (what === "finished") {
    try {
      await requireOwner();
      await markOnboarding(db(), "finished");
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
    }
    kickAgent();
    revalidatePath("/", "layout");
    redirect("/this-week");
  }
  return step(async () => {
    await requireOwner();
    if (what === "agent" && readEnv().BURSAR_MODE !== "dry-run") throw new Error("Your wallet turns the agent on: use the buttons above.");
    if (what !== "people" && what !== "money" && what !== "agent") throw new Error("Unknown step.");
    await markOnboarding(db(), what);
  });
}

/** Practice mode: start an empty business of your own (the sample restaurant is cleared). */
export async function startOwnPracticeAction(): Promise<FormResult> {
  if (readEnv().BURSAR_MODE !== "dry-run") return { ok: false, message: "This is for practice mode." };
  try {
    await clearPracticeBusiness(db());
    await clearOnboarding(db());
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
  revalidatePath("/", "layout");
  redirect("/welcome");
}

export type InviteResult = { ok: true; link: string; name: string } | { ok: false; message: string };

export async function createInviteAction(f: FormData): Promise<InviteResult> {
  try {
    const owner = await requireOwner();
    const category = PayeeCategory.parse(text(f, "category") || "staff");
    const invite = await createInvite(db(), owner, { name: text(f, "name"), category, recurring: recurringFrom(f) });
    revalidatePath("/", "layout");
    return { ok: true, link: `${readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/join/${invite.token}`, name: invite.name };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't make the link." };
  }
}

export async function approveInviteAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await approveInvite(db(), await requireOwner(), text(f, "inviteId"));
    revalidatePath("/", "layout");
    return readEnv().BURSAR_MODE === "dry-run"
      ? "Added. Their first payment will still ask for your OK."
      : "Added. Now confirm the updated list with your wallet (Spending rules) so they can be paid.";
  });
}

export async function declineInviteAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await declineInvite(db(), await requireOwner(), text(f, "inviteId"));
    revalidatePath("/", "layout");
    return "Declined. Nothing was added.";
  });
}

/** The invited person's form (no sign-in: the link is the key). */
export async function submitInviteAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await submitInvite(db(), text(f, "token"), { assetId: text(f, "token_asset"), address: text(f, "address"), memo: text(f, "memo") });
    return "Thanks! Sent. You'll be paid once the business confirms your details.";
  });
}
