import { createHash } from "node:crypto";

// DRY-RUN ONLY. 1Click validates the recipient address even on dry quotes, so
// sample payees need well-formed addresses. These are derived from a hash of a
// label: they pass the address checks but nobody holds a key for them. Live
// mode never uses them; real payees enter their own addresses.

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function sha256(data: Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

export function base58(bytes: Buffer): string {
  let n = BigInt("0x" + (bytes.toString("hex") || "0"));
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

function body20(label: string): Buffer {
  return sha256(`bursar-dry-run:${label}`).subarray(0, 20);
}

/** Tron address: base58check(0x41 ‖ 20 bytes). */
export function demoTronAddress(label: string): string {
  const payload = Buffer.concat([Buffer.from([0x41]), body20(label)]);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return base58(Buffer.concat([payload, checksum]));
}

/** EVM address (lowercase hex, 20 bytes). */
export function demoEvmAddress(label: string): string {
  return "0x" + body20(label).toString("hex");
}
