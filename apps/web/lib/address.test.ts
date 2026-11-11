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
    expect(addressProblem("sui", "0x" + "5e93a736".repeat(8))).toBeNull();
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
    expect(addressProblem("sui", demoEvmAddress("a"))).toMatch(/Sui address/); // 40 hex is EVM, not Sui
    expect(addressProblem("sui", "0x" + "5E93A736".repeat(8))).not.toBeNull();
    expect(addressProblem("tron", "")).toBe("Enter their address.");
    expect(addressProblem("near", demoNearImplicit("a").slice(1))).not.toBeNull(); // 63 hex chars
  });
});

describe("shortenAddresses", () => {
  it("shortens long addresses inside a sentence and leaves short words alone", async () => {
    const { shortenAddresses } = await import("./address");
    const hex = "d55acc2289345e95a8c5b0328bd27b9646cca817a095be820b7eae9ad502179";
    expect(shortenAddresses(`Bursr only ever pays at ${hex}.`)).toBe("Bursr only ever pays at d55acc…2179.");
    expect(shortenAddresses("Invoice #MPF-0412 from Mama Put Farms Ltd")).toBe("Invoice #MPF-0412 from Mama Put Farms Ltd");
  });
});
