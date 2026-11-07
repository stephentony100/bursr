import OpenAI from "openai";
import type { PrismaClient } from "./generated/prisma/client";
import { readEnv } from "./env";
import { formatUsd } from "./money";
import { DEFAULT_READER_MODEL } from "./reader";
import { statementLines } from "./statement";

// The monthly summary in plain words. Bursar computes every figure itself from
// its own records; NEAR AI may only phrase them. A summary that contains any
// number not in those facts is rejected (AGENTS.md rule 5: never invent amounts).

export interface MonthFacts {
  month: string; // "November 2026"
  paidUsd: bigint;
  payments: number;
  staffUsd: bigint;
  suppliersUsd: bigint;
  otherUsd: bigint;
  feesUsd: bigint;
  topPayees: { name: string; usd: bigint }[];
  invoices: number;
  invoicesReady: number;
  invoicesBlocked: number;
  invoicesHeld: number;
  refusedByAccount: number;
  failedPayments: number;
}

export async function monthFacts(db: PrismaClient, now = new Date()): Promise<MonthFacts> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const inMonth = (d: Date) => d >= from && d < to;

  const lines = (await statementLines(db)).filter((l) => inMonth(l.date));
  const paid = lines.filter((l) => l.status !== "Failed");
  const payees = await db.payee.findMany({ select: { name: true, category: true } });
  const category = new Map(payees.map((p) => [p.name, p.category]));
  const sum = (xs: { amountUsd: bigint }[]) => xs.reduce((a, x) => a + x.amountUsd, 0n);

  const isFee = (l: { forWhat: string }) => l.forWhat.startsWith("Bursar fee");
  const byPayee = new Map<string, bigint>();
  for (const l of paid.filter((x) => !isFee(x))) byPayee.set(l.payee, (byPayee.get(l.payee) ?? 0n) + l.amountUsd);

  const invoices = await db.invoice.findMany({ where: { receivedAt: { gte: from, lt: to } }, select: { status: true } });
  const refused = await db.auditEvent.count({ where: { kind: "account_refused", at: { gte: from, lt: to } } });

  return {
    month: from.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    paidUsd: sum(paid),
    payments: paid.length,
    staffUsd: sum(paid.filter((l) => category.get(l.payee) === "staff")),
    suppliersUsd: sum(paid.filter((l) => category.get(l.payee) === "supplier")),
    otherUsd: sum(paid.filter((l) => !isFee(l) && !["staff", "supplier"].includes(category.get(l.payee) ?? ""))),
    feesUsd: sum(paid.filter(isFee)),
    topPayees: [...byPayee.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1)).slice(0, 3).map(([name, usd]) => ({ name, usd })),
    invoices: invoices.length,
    invoicesReady: invoices.filter((i) => i.status === "ready" || i.status === "flag").length,
    invoicesBlocked: invoices.filter((i) => i.status === "block").length,
    invoicesHeld: invoices.filter((i) => ["hold", "needs_owner", "defer"].includes(i.status)).length,
    refusedByAccount: refused,
    failedPayments: lines.length - paid.length,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The summary Bursar writes itself, with no AI: always available, always exact. */
export function plainSummary(f: MonthFacts): string {
  const parts = [
    `In ${f.month} Bursar paid ${formatUsd(f.paidUsd)} in ${plural(f.payments, "payment")}: ${formatUsd(f.staffUsd)} to staff and ${formatUsd(f.suppliersUsd)} to suppliers${f.otherUsd > 0n ? `, ${formatUsd(f.otherUsd)} to others` : ""}${f.feesUsd > 0n ? `, and ${formatUsd(f.feesUsd)} in Bursar fees` : ""}.`,
  ];
  if (f.topPayees.length) parts.push(`The largest was ${f.topPayees[0].name} at ${formatUsd(f.topPayees[0].usd)}.`);
  parts.push(
    `${plural(f.invoices, "invoice")} came in: ${f.invoicesReady} passed every check, ${f.invoicesBlocked} ${f.invoicesBlocked === 1 ? "was" : "were"} blocked as possible fraud and ${f.invoicesHeld} ${f.invoicesHeld === 1 ? "was" : "were"} held for you to check.`,
  );
  if (f.refusedByAccount) parts.push(`The agent account refused ${plural(f.refusedByAccount, "payment")} that broke your rules.`);
  if (f.failedPayments) parts.push(`${plural(f.failedPayments, "payment")} could not be sent; the statement says why.`);
  return parts.join(" ");
}

/** Every number a summary may mention: the facts, formatted the ways a writer might. */
export function allowedNumbers(f: MonthFacts): Set<string> {
  const out = new Set<string>();
  const addUsd = (v: bigint) => {
    const s = formatUsd(v).replace("$", "");
    out.add(s);
    out.add(s.replace(/,/g, ""));
    out.add(s.replace(/\.00$/, ""));
    out.add(s.replace(/,/g, "").replace(/\.00$/, ""));
  };
  [f.paidUsd, f.staffUsd, f.suppliersUsd, f.otherUsd, f.feesUsd, ...f.topPayees.map((p) => p.usd)].forEach(addUsd);
  [f.payments, f.invoices, f.invoicesReady, f.invoicesBlocked, f.invoicesHeld, f.refusedByAccount, f.failedPayments].forEach((n) => out.add(String(n)));
  for (const m of f.month.match(/\d+/g) ?? []) out.add(m);
  return out;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

/** Numbers in a text (digits or words up to twenty) that are not in the facts. Empty means nothing was invented. */
export function inventedNumbers(text: string, f: MonthFacts): string[] {
  const allowed = allowedNumbers(f);
  const digits = (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/[.,]$/, "")).filter((n) => !allowed.has(n));
  const words = (text.toLowerCase().match(new RegExp(`\\b(${WORDS.join("|")})\\b`, "g")) ?? []).filter((w) => !allowed.has(String(WORDS.indexOf(w))));
  return [...digits, ...words];
}

export type AiSummary = { ok: true; text: string; model: string } | { ok: false; reason: string };

/** Asks NEAR AI Cloud to phrase the facts warmly; rejected if it adds any figure. */
export async function aiSummary(f: MonthFacts): Promise<AiSummary> {
  const env = readEnv();
  if (!env.NEAR_AI_API_KEY) return { ok: false, reason: "Needs NEAR_AI_API_KEY; the summary above is Bursar's own." };
  const model = env.NEAR_AI_MODEL ?? DEFAULT_READER_MODEL;
  const client = new OpenAI({ baseURL: env.NEAR_AI_BASE_URL, apiKey: env.NEAR_AI_API_KEY, timeout: 60_000, maxRetries: 1 });
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You write a short monthly money summary for a small restaurant owner in Lagos, in plain, warm English (3–5 sentences, no jargon, no crypto words). " +
            "Use ONLY the figures in the facts, written exactly as given. Do not add, round, estimate or calculate any number. Do not give advice.",
        },
        { role: "user", content: `Facts:\n${plainSummary(f)}` },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return { ok: false, reason: "The AI returned nothing." };
    const invented = inventedNumbers(text, f);
    if (invented.length) return { ok: false, reason: `Rejected: the AI mentioned ${invented.join(", ")}, which is not in your records.` };
    return { ok: true, text, model };
  } catch (e) {
    return { ok: false, reason: `NEAR AI could not write it (${e instanceof Error ? e.message : e}).` };
  }
}
