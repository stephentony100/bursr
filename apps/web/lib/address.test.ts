import { describe, expect, it } from "vitest";
import { addressProblem } from "./address";
import { demoEvmAddress, demoNearImplicit, demoSolanaAddress, demoTronAddress } from "./demo-addresses";

describe("payout address checks", () => {
  it("accepts well-formed addresses per network", () => {
    expect(addressProblem("tron", demoTronAddress("a"))).toBeNull();
    expect(addressProblem("base", demoEvmAddress("a"))).toBeNull();
    expect(addressProblem("near", "stephentony.near")).toBeNull();
    expect(addressProblem("near", demoNearImplicit("a"))).toBeNull();
    expect(addressProblem("sol", demoSolanaAddress("a"))).toBeNull();
  });

  it("rejects a Tron address with one character changed (checksum)", () => {
    const a = demoTronAddress("a");
    const flipped = a.slice(0, 10) + (a[10] === "A" ? "B" : "A") + a.slice(11);
    expect(addressProblem("tron", flipped)).toMatch(/Tron address/);
  });

  it("rejects the wrong format for the network", () => {
    expect(addressProblem("tron", demoEvmAddress("a"))).not.toBeNull();
    expect(addressProblem("base", demoTronAddress("a"))).not.toBeNull();
    expect(addressProblem("near", "Not A Near Account")).not.toBeNull();
    expect(addressProblem("base", "0x123")).not.toBeNull();
    expect(addressProblem("sol", "abc")).not.toBeNull();
    expect(addressProblem("tron", "")).toBe("Enter their address.");
  });
});
