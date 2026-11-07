import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { boundIdentity, expectedMrConfigId, replayRtmr3 } from "./attestation";

const sha384 = (...parts: Buffer[]) => {
  const h = createHash("sha384");
  for (const p of parts) h.update(p);
  return h.digest();
};

// One RTMR3 event computed by hand from the docs' rule:
// digest = SHA-384(event_type LE32 ‖ ":" ‖ event ‖ ":" ‖ payload); RTMR3 = SHA-384(0×48 ‖ digest)
const type = Buffer.alloc(4);
type.writeUInt32LE(134217729);
const digest = sha384(type, Buffer.from(":"), Buffer.from("compose-hash"), Buffer.from(":"), Buffer.from("abcd", "hex"));
const event = { imr: 3, event_type: 134217729, event: "compose-hash", event_payload: "abcd", digest: digest.toString("hex") };

describe("TEE attestation checks (offline parts)", () => {
  it("replays RTMR3 exactly as the docs describe, ignoring other registers", () => {
    const other = { imr: 1, event_type: 1, event: "x", event_payload: "", digest: "" };
    expect(replayRtmr3([other, event])).toEqual(sha384(Buffer.alloc(48), digest));
    expect(replayRtmr3(JSON.stringify([event]))).toEqual(sha384(Buffer.alloc(48), digest)); // gateway sends a JSON string
  });

  it("rejects a tampered event payload", () => {
    expect(() => replayRtmr3([{ ...event, event_payload: "abce" }])).toThrow(/digest mismatch/);
  });

  it("binds an ECDSA signer as 20 bytes zero-padded to 32", () => {
    const b = boundIdentity({ signing_address: "0x2665cce942fa427ef30d87f4b0bff67fb7645462", signing_algo: "ecdsa" });
    expect(b.length).toBe(32);
    expect(b.subarray(0, 20).toString("hex")).toBe("2665cce942fa427ef30d87f4b0bff67fb7645462");
    expect(b.subarray(20).every((x) => x === 0)).toBe(true);
  });

  it("refuses a signer whose length does not fit its algorithm", () => {
    expect(() => boundIdentity({ signing_address: "0x1234", signing_algo: "ecdsa" })).toThrow();
  });

  it("MRCONFIGID is 01 ‖ sha256(app_compose) ‖ 15 zero bytes, over the exact string", () => {
    const m = expectedMrConfigId('{"a":1}');
    expect(m.length).toBe(48);
    expect(m[0]).toBe(1);
    expect(m.subarray(1, 33)).toEqual(createHash("sha256").update('{"a":1}').digest());
    expect(expectedMrConfigId('{"a": 1}').equals(m)).toBe(false); // no reserialising
  });
});
