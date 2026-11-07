"use server";

import { revalidatePath } from "next/cache";
import { verifyReader, type AttestationResult } from "@/lib/attestation";
import { aiSummary, monthFacts, type AiSummary } from "@/lib/summary";
import { agentAccount, type ActionRequest } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { loadSampleBusiness, loadSampleInvoices } from "@/lib/demo-loader";
import { ingestInvoice } from "@/lib/invoices";
import { demoEvmAddress, demoNearImplicit, demoTronAddress } from "@/lib/demo-addresses";
import { PayeeCategory, type Payout, type PriceItem } from "@/lib/domain";
import { readEnv } from "@/lib/env";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "@/lib/money";
import {
  addPayee,
  approvePlan,
  approvePlanItem,
  changePayout,
  removePayee,
  removePlanItem,
  setFrozen,
  updatePayeeDetails,
  updateRules,
} from "@/lib/owner-actions";
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
    throw new Error(`${label}: enter an amount like 250 or 250.50`);
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
    return "Sample restaurant loaded.";
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
    if (chosen.length === 0) throw new Error("Choose at least one way to pay people.");
    const inUse = (await listPayees(db())).filter((p) => !allowed.has(p.payout.token.assetId));
    if (inUse.length) throw new Error(`${inUse[0].name} is paid in a token you unticked. Change their payout first.`);
    await updateRules(db(), owner, {
      ...business.rules,
      weeklyCapUsd: dollars(f, "weeklyCap", "Weekly limit"),
      perPaymentCapUsd: dollars(f, "perPaymentCap", "Largest single payment"),
      approvalThresholdUsd: dollars(f, "approvalThreshold", "Ask me first above"),
      paydayWeekday: Number(text(f, "payday")),
      payoutTokens: chosen,
    });
    return "Rules saved.";
  });
}

export async function toggleFreeze(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    if (readEnv().BURSAR_MODE !== "dry-run") throw new Error("In live mode, freeze from your wallet below.");
    const freeze = text(f, "freeze") === "1";
    await setFrozen(db(), await requireOwner(), freeze);
    return freeze ? "Payments frozen. Nothing can be paid until you unfreeze." : "Payments unfrozen.";
  });
}

function parsePrices(raw: string): PriceItem[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.+?)\s*[=:]\s*\$?\s*(\d+(?:\.\d{1,2})?)$/.exec(line);
      if (!m) throw new Error(`Agreed prices: write each line like "Tomatoes (crate) = 18.00" (problem: "${line}")`);
      return { item: m[1], unitPriceUsd: parseUnits(m[2], USD_DECIMALS).toString(), toleranceBps: 500 };
    });
}

async function payoutFrom(f: FormData): Promise<Payout> {
  const business = await getBusiness(db());
  if (!business) throw new Error("Set up the business first.");
  const token = business.rules.payoutTokens.find((t) => t.assetId === text(f, "token"));
  if (!token) throw new Error("Choose how they are paid.");
  const address = text(f, "address");
  if (!address) throw new Error("Enter their payout address.");
  return { token, address, memo: text(f, "memo") || null };
}

function recurringFrom(f: FormData) {
  const amount = text(f, "recurringAmount");
  if (!amount) return null;
  return { amountUsd: dollars(f, "recurringAmount", "Regular pay"), every: text(f, "recurringEvery") === "month" ? ("month" as const) : ("week" as const) };
}

export async function addPayeeAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const name = text(f, "name");
    if (!name) throw new Error("Enter the payee's name.");
    await addPayee(db(), await requireOwner(), {
      name,
      category: PayeeCategory.parse(text(f, "category")),
      payout: await payoutFrom(f),
      prices: parsePrices(text(f, "prices")),
      recurring: recurringFrom(f),
    });
    return `${name} added.`;
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
    return "Details saved.";
  });
}

export async function changePayoutAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    const id = text(f, "id");
    const payee = await getPayee(db(), id);
    if (!payee) throw new Error("Payee not found.");
    await changePayout(db(), await requireOwner(), id, await payoutFrom(f));
    return `Payout details changed. Payments to ${payee.name} are on hold for 48 hours.`;
  });
}

export async function removePayeeAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await removePayee(db(), await requireOwner(), text(f, "id"));
    return "Payee removed.";
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
  if (!business) return { tried: "", allowed: false, message: "Load the sample restaurant or add a payee first." };
  // Prefer a supplier paid in the token the account holds, so only the rule under test decides
  // (paying in another token needs a swap first, which the payment run does).
  const inTreasury = payees.filter((p) => p.payout.token.assetId === business.rules.treasury.assetId);
  const payee = inTreasury.find((p) => p.category === "supplier") ?? inTreasury[0] ?? payees[0];
  if (!payee) return { tried: "", allowed: false, message: "Load the sample restaurant or add a payee first." };
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
    tried = `Pay ${payee.name} ${formatUsd(over)}, $1 over your largest single payment`;
  } else if (scenario === "stranger") {
    const addr = token.chain === "tron" ? demoTronAddress("not-a-payee") : token.chain === "near" ? demoNearImplicit("not-a-payee") : demoEvmAddress("not-a-payee");
    req = { ...base, amount: amountFor(parseUnits("50", USD_DECIMALS)), recipient: addr };
    tried = `Pay $50.00 to an address that is not on your payee list`;
  } else {
    req = { ...base, amount: amountFor(parseUnits("50", USD_DECIMALS)), recipient: payee.payout.address };
    tried = `Pay ${payee.name} $50.00`;
  }
  try {
    const out = await (await agentAccount(db())).preview(req);
    return out.status === "refused"
      ? { tried, allowed: false, message: out.refusal.message }
      : { tried, allowed: true, message: "The account would allow this payment." };
  } catch (e) {
    return { tried, allowed: false, message: e instanceof Error ? e.message : "The account could not be reached." };
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
      if (file.size > MAX_UPLOAD) throw new Error("That file is over 4 MB. Send a smaller photo.");
      if (!ALLOWED_TYPES.has(file.type)) throw new Error("Bursar reads photos (PNG, JPG, WebP) and pasted text. For a PDF, send a photo or screenshot of it.");
      input = { name: file.name, mediaType: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
    } else if (pasted) {
      input = { name: "pasted text", mediaType: "text/plain", bytes: Buffer.from(pasted.slice(0, 20_000), "utf8") };
    } else {
      throw new Error("Choose a photo of the invoice or paste its text.");
    }
    const v = await ingestInvoice(db(), input);
    const label = v.supplierName ? `${v.supplierName} #${v.invoiceNumber}` : input.name;
    const words: Record<string, string> = {
      ready: "is ready to pay",
      flag: "is ready to pay, with a warning",
      defer: "moves to next week",
      hold: "is on hold for you to check",
      block: "is blocked",
      needs_owner: "needs you",
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
    return "The six sample invoices were read and checked again.";
  });
}

// --- The weekly plan ---------------------------------------------------------

export async function preparePlanAction(): Promise<FormResult> {
  return run(async () => {
    await requireOwner();
    const plan = await prepareWeeklyPlan(db());
    const n = plan.items.filter((i) => i.placement === "in").length;
    return `Plan ready: ${n} payment${n === 1 ? "" : "s"} to approve.`;
  });
}

export async function approveItemAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await approvePlanItem(db(), await requireOwner(), text(f, "itemId"));
    return "Approved.";
  });
}

export async function removeItemAction(_prev: FormResult, f: FormData): Promise<FormResult> {
  return run(async () => {
    await removePlanItem(db(), await requireOwner(), text(f, "itemId"));
    return "Removed from this plan.";
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
    return `Plan approved. ${sent} payment${sent === 1 ? "" : "s"} sent${failed ? `, ${failed} failed (see the reasons below)` : ""}.`;
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
  const tried = `Send ${formatUsd(over)} to ${payee.name} directly, skipping the plan and approval`;
  try {
    const account = await agentAccount(db());
    const out = readEnv().BURSAR_MODE === "dry-run" ? await account.execute(req, `forced-${Date.now()}`) : await account.preview(req);
    revalidatePath("/", "layout");
    return out.status === "refused"
      ? { tried, allowed: false, message: out.refusal.message }
      : { tried, allowed: true, message: "The account accepted it. Check the rules: this should not happen." };
  } catch (e) {
    return { tried, allowed: false, message: e instanceof Error ? e.message : "The account could not be reached." };
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
