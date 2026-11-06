import type { Payee } from "../domain";

// Supplier-name helpers shared by the supplier checks.

const SUFFIXES = /\b(ltd|limited|plc|nig|nigeria|enterprises?|ventures|co|company|inc|llc)\b\.?/g;

/** "Mama Put Farms Ltd." → "mama put farms". Case, punctuation and company suffixes don't matter. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Characters fraudsters swap for look-alikes: 0/o, 1/l/i, 5/s, rn/m, vv/w, cl/d.
const CONFUSABLES: [RegExp, string][] = [
  [/rn/g, "m"],
  [/vv/g, "w"],
  [/cl/g, "d"],
  [/0/g, "o"],
  [/[1|!]/g, "l"],
  [/i/g, "l"],
  [/3/g, "e"],
  [/5/g, "s"],
  [/\$/g, "s"],
  [/8/g, "b"],
  [/\s/g, ""],
];

/** A "skeleton" that maps look-alike spellings to the same string. */
export function skeleton(name: string): string {
  let s = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "");
  s = s.replace(/&/g, "and").replace(/[^\p{L}\p{N}\s$|!]/gu, " ");
  s = s.replace(SUFFIXES, " ");
  for (const [re, to] of CONFUSABLES) s = s.replace(re, to);
  return s;
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** The payee whose name matches exactly (after normalising), if any. */
export function exactPayee(supplierName: string, payees: Payee[]): Payee | null {
  const n = normaliseName(supplierName);
  return payees.find((p) => normaliseName(p.name) === n) ?? null;
}

/** A payee whose name this one imitates: same skeleton, or one or two letters off, but not the same name. */
export function lookAlikeOf(supplierName: string, payees: Payee[]): Payee | null {
  if (exactPayee(supplierName, payees)) return null;
  const sk = skeleton(supplierName);
  for (const p of payees) {
    const psk = skeleton(p.name);
    if (sk === psk) return p;
    const limit = psk.length >= 12 ? 2 : psk.length >= 6 ? 1 : 0;
    if (limit > 0 && levenshtein(sk, psk) <= limit) return p;
  }
  return null;
}
