// Money is always an integer in smallest units (bigint in code, decimal string
// in storage and JSON). Never a float. Decimals come from the token list.

/** USD amounts inside Bursr use 6 decimals (micro-dollars), like the Agent API's spent_usd. */
export const USD_DECIMALS = 6;

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;

/** "12.5" with 6 decimals → 12500000n. Rejects more fractional digits than the token has. */
export function parseUnits(text: string, decimals: number): bigint {
  const m = DECIMAL_RE.exec(text.trim());
  if (!m) throw new Error(`not a plain decimal amount: "${text}"`);
  const [, whole, frac = ""] = m;
  if (frac.length > decimals) throw new Error(`"${text}" has more than ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/** 12500000n with 6 decimals → "12.5". */
export function formatUnits(amount: bigint, decimals: number): string {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

/** For screens: "$1,234.50". */
export function formatUsd(micros: bigint): string {
  const cents = (micros + 5_000n) / 10_000n; // round half up to cents
  const whole = cents / 100n;
  const rest = (cents % 100n).toString().padStart(2, "0");
  return `$${whole.toLocaleString("en-US")}.${rest}`;
}

/** Converts an amount between two decimal precisions (exact when scaling up, floors when scaling down). */
export function rescale(amount: bigint, from: number, to: number): bigint {
  if (to >= from) return amount * 10n ** BigInt(to - from);
  return amount / 10n ** BigInt(from - to);
}

export const toStr = (n: bigint) => n.toString();
export const fromStr = (s: string) => {
  if (!/^-?\d+$/.test(s)) throw new Error(`not an integer amount: "${s}"`);
  return BigInt(s);
};
