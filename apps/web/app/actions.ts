"use server";

import { revalidatePath } from "next/cache";
import { agentAccount, type ActionRequest } from "@/lib/agent-account";
import { db } from "@/lib/db";
import { loadSampleBusiness } from "@/lib/demo-loader";
import { demoEvmAddress, demoNearImplicit, demoTronAddress } from "@/lib/demo-addresses";
import { PayeeCategory, type Payout, type PriceItem } from "@/lib/domain";
import { readEnv } from "@/lib/env";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "@/lib/money";
import { addPayee, changePayout, removePayee, setFrozen, updatePayeeDetails, updateRules } from "@/lib/owner-actions";
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
