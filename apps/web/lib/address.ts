import { createHash } from "node:crypto";

// Format checks for payout addresses, so a typo is caught before the owner
// signs it into the account's allowlist. A format check cannot prove the
// address belongs to the payee; that is why changes start a 48-hour hold.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function decode58(s: string): Buffer | null {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const lead = s.length - s.replace(/^1+/, "").length;
  return Buffer.concat([Buffer.alloc(lead), Buffer.from(n === 0n ? "" : hex, "hex")]);
}

const sha = (b: Buffer) => createHash("sha256").update(b).digest();

function isTron(a: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return false;
  const raw = decode58(a);
  if (!raw || raw.length !== 25 || raw[0] !== 0x41) return false;
  return raw.subarray(21).equals(sha(sha(raw.subarray(0, 21))).subarray(0, 4));
}

const isEvm = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

// NEAR account ids: the same pattern HACKATHON.md gives for nearAddress, 2–64 chars.
const NEAR_ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const isNear = (a: string) => a.length >= 2 && a.length <= 64 && NEAR_ACCOUNT.test(a);

function isSolana(a: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return false;
  return decode58(a)?.length === 32;
}

const EVM_STYLE = new Set(["eth", "base", "arb", "pol", "bsc", "op", "avax"]);

/** Returns a plain-English problem, or null when the address looks right for the network. */
export function addressProblem(chain: string, address: string): string | null {
  const a = address.trim();
  if (!a) return "Enter their address.";
  const ok =
    chain === "tron" ? isTron(a) : chain === "near" ? isNear(a) : chain === "sol" ? isSolana(a) : EVM_STYLE.has(chain) ? isEvm(a) : true;
  if (ok) return null;
  const hint: Record<string, string> = {
    tron: "a Tron address starts with T and has 34 characters",
    near: "a NEAR account looks like name.near or is 64 lowercase hex characters",
    sol: "a Solana address is 32 to 44 letters and numbers",
  };
  return `That doesn't look like a valid address for this network (${hint[chain] ?? "an address starts with 0x and has 42 characters"}). Check it with the payee.`;
}
