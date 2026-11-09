import { afterEach, describe, expect, it, vi } from "vitest";
import { canReceiveOnNear, nep141Contract } from "./near-storage";

const USDC = "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
const rpc = (value: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ result: { result: [...Buffer.from(JSON.stringify(value))] } })));

describe("can a NEAR account receive a token", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reads the token contract from the asset id", () => {
    expect(nep141Contract(USDC)).toBe("17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1");
    expect(nep141Contract("nep245:x")).toBeNull();
  });

  it("is false for an account never registered with the token, true once registered", async () => {
    rpc(null);
    expect(await canReceiveOnNear(USDC, "new.near", "https://rpc.test")).toBe(false);
    rpc({ total: "1250000000000000000000", available: "0" });
    expect(await canReceiveOnNear(USDC, "old.near", "https://rpc.test")).toBe(true);
  });

  it("doesn't block a payment when the chain can't be asked", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await canReceiveOnNear(USDC, "x.near", "https://rpc.test")).toBeNull();
  });
});
