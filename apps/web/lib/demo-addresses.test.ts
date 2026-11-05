import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base58, demoEvmAddress, demoTronAddress } from "./demo-addresses";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const sha = (b: Buffer) => createHash("sha256").update(b).digest();

function decode58(s: string): Buffer {
  let n = 0n;
  for (const c of s) n = n * 58n + BigInt(B58.indexOf(c));
  const hex = n.toString(16);
  return Buffer.from(hex.length % 2 ? "0" + hex : hex, "hex");
}

describe("demo addresses (dry-run only)", () => {
  it("makes a Tron address with a valid base58check checksum and 0x41 prefix", () => {
    const addr = demoTronAddress("payee-1");
    expect(addr).toMatch(/^T[1-9A-HJ-NP-Za-km-z]{33}$/);
    const raw = decode58(addr);
    expect(raw.length).toBe(25);
    expect(raw[0]).toBe(0x41);
    expect(raw.subarray(21).equals(sha(sha(raw.subarray(0, 21))).subarray(0, 4))).toBe(true);
  });

  it("rejects a tampered Tron address checksum", () => {
    const raw = decode58(demoTronAddress("payee-1"));
    raw[5] ^= 0xff;
    expect(raw.subarray(21).equals(sha(sha(raw.subarray(0, 21))).subarray(0, 4))).toBe(false);
  });

  it("is deterministic per label and differs across labels", () => {
    expect(demoTronAddress("a")).toBe(demoTronAddress("a"));
    expect(demoTronAddress("a")).not.toBe(demoTronAddress("b"));
    expect(demoEvmAddress("a")).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("base58 keeps leading zero bytes as '1'", () => {
    expect(base58(Buffer.from([0, 0, 1]))).toBe("112");
  });
});
