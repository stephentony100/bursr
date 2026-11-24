import { describe, expect, it } from "vitest";
import { STELLAR_NETWORKS, stellarNetworkName } from "./stellar-network";
import { stellarConfig } from "./stellar";

describe("stellar network", () => {
  it("is testnet unless mainnet is asked for", () => {
    expect(stellarNetworkName(undefined)).toBe("testnet");
    expect(stellarNetworkName("anything")).toBe("testnet");
    expect(stellarNetworkName("mainnet")).toBe("mainnet");
  });

  it("has Circle's USDC contract on each network (stellar contract id asset)", () => {
    expect(STELLAR_NETWORKS.testnet.usdcContract).toBe("CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA");
    expect(STELLAR_NETWORKS.mainnet.usdcContract).toBe("CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75");
    expect(STELLAR_NETWORKS.mainnet.friendbotUrl).toBeNull();
  });

  it("needs an RPC provider on mainnet and gives no friendbot there", () => {
    const keep = { ...process.env };
    try {
      process.env.STELLAR_NETWORK = "mainnet";
      delete process.env.STELLAR_RPC_URL;
      expect(() => stellarConfig()).toThrow(/STELLAR_RPC_URL/);
      process.env.STELLAR_RPC_URL = "https://rpc.example.org";
      const c = stellarConfig();
      expect(c.passphrase).toBe("Public Global Stellar Network ; September 2015");
      expect(c.friendbotUrl).toBeNull();
    } finally {
      process.env = keep;
    }
  });
});
