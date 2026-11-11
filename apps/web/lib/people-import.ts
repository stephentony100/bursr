import { addressProblem } from "./address";
import { chainName } from "./chains";
import type { Payee, PayoutToken } from "./domain";
import { parseUnits, USD_DECIMALS } from "./money";
import type { PayeeInput } from "./owner-actions";

// Adding many people at once from a spreadsheet (saved as CSV). Every row is
// checked the same way the "Add someone" form checks one person; the owner
// sees each row's problem in plain words and adds them all in one go.

export const IMPORT_HEADERS = ["Name", "Type", "Regular pay", "Every", "Paid in", "Wallet address", "Memo"] as const;

export function importTemplate(tokens: PayoutToken[]): string {
  const paidIn = (t: PayoutToken | undefined) => (t ? `${t.symbol} on ${chainName(t.chain)}` : "USDC on Base");
  return [
    IMPORT_HEADERS.join(","),
    `Amaka Eze,staff,120,week,${paidIn(tokens[0])},their-address,`,
    `Mama Put Farms,supplier,,,${paidIn(tokens[1] ?? tokens[0])},their-address,`,
  ].join("\n");
}

export interface ImportRow {
  line: number;
  name: string;
  /** What will be added, or why this row can't be. */
  input: PayeeInput | null;
  problem: string | null;
  /** For the preview, in plain words. */
  summary: string;
}

/** CSV cells, with quoted cells ("Eze, Amaka") and doubled quotes inside them. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === ";" || c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function findColumn(headers: string[], ...names: string[]) {
  const wanted = names.map(norm);
  return headers.findIndex((h) => wanted.includes(norm(h)));
}

/** "USDC on Base", "usdc base", "USDT (Tron)" → one of the business's allowed tokens. */
export function tokenFromWords(words: string, tokens: PayoutToken[]): PayoutToken | null {
  const w = norm(words);
  if (!w) return null;
  return tokens.find((t) => w === norm(`${t.symbol}${chainName(t.chain)}`) || w === norm(`${t.symbol}on${chainName(t.chain)}`) || w === norm(`${t.symbol}${t.chain}`)) ?? null;
}

function categoryFrom(words: string): Payee["category"] | null {
  const w = norm(words);
  if (!w || w === "staff" || w === "employee" || w === "worker") return "staff";
  if (w === "supplier" || w === "vendor") return "supplier";
  if (w === "subscription" || w === "service" || w === "software") return "software";
  return null;
}

function everyFrom(words: string): "week" | "two_weeks" | "month" | null {
  const w = norm(words);
  if (!w || w === "week" || w === "weekly") return "week";
  if (w === "2weeks" || w === "twoweeks" || w === "fortnight" || w === "fortnightly" || w === "biweekly") return "two_weeks";
  if (w === "month" || w === "monthly") return "month";
  return null;
}

export function readImport(text: string, tokens: PayoutToken[]): { rows: ImportRow[]; problem: string | null } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], problem: "The file has no people in it. Use the template: one person per row under the headings." };
  const headers = table[0];
  const col = {
    name: findColumn(headers, "name", "their name", "full name"),
    type: findColumn(headers, "type", "category"),
    pay: findColumn(headers, "regular pay", "amount", "pay", "wage", "wages"),
    every: findColumn(headers, "every", "how often", "frequency"),
    paidIn: findColumn(headers, "paid in", "how they want to be paid", "token", "currency"),
    address: findColumn(headers, "wallet address", "address", "wallet"),
    memo: findColumn(headers, "memo"),
  };
  if (col.name < 0 || col.paidIn < 0 || col.address < 0) {
    return { rows: [], problem: `The headings must include Name, Paid in and Wallet address (found: ${headers.join(", ")}). Download the template to see the layout.` };
  }
  const allowed = tokens.map((t) => `${t.symbol} on ${chainName(t.chain)}`).join(", ");
  const rows = table.slice(1).map((r, i): ImportRow => {
    const get = (c: number) => (c >= 0 ? (r[c] ?? "") : "");
    const line = i + 2;
    const name = get(col.name);
    const fail = (problem: string): ImportRow => ({ line, name, input: null, problem, summary: "" });
    if (!name) return fail("No name.");
    const category = categoryFrom(get(col.type));
    if (!category) return fail(`Type "${get(col.type)}" should be staff, supplier or subscription.`);
    const token = tokenFromWords(get(col.paidIn), tokens);
    if (!token) return fail(`"${get(col.paidIn) || "(empty)"}" isn't a way your rules allow. Use one of: ${allowed}.`);
    const address = get(col.address);
    if (!address) return fail("No wallet address.");
    const bad = addressProblem(token.chain, address);
    if (bad) return fail(bad);
    let recurring: Payee["recurring"] = null;
    const pay = get(col.pay).replace(/^\$/, "").replace(/,/g, "");
    if (pay) {
      let amountUsd: string;
      try {
        amountUsd = parseUnits(pay, USD_DECIMALS).toString();
      } catch {
        return fail(`Regular pay "${get(col.pay)}" should be an amount like 120 or 120.50.`);
      }
      if (BigInt(amountUsd) <= 0n) return fail("Regular pay must be more than $0.");
      const every = everyFrom(get(col.every));
      if (!every) return fail(`Every "${get(col.every)}" should be week, 2 weeks or month.`);
      recurring = { amountUsd, every };
    }
    const input: PayeeInput = { name, category, payout: { token, address, memo: get(col.memo) || null }, prices: [], recurring };
    const how = recurring ? `$${pay} every ${recurring.every === "two_weeks" ? "2 weeks" : recurring.every}` : "paid by invoice";
    return { line, name, input, problem: null, summary: `${category} · ${how} · ${token.symbol} on ${chainName(token.chain)}` };
  });
  return { rows, problem: null };
}
