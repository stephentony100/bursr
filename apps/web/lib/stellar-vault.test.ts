import { describe, expect, it } from "vitest";
import type { Policy } from "@near-intents-agent-api/sdk";
import { payeeDiff, paymentKey, refusalForVaultError, STELLAR_USDC, vaultErrorCode, VAULT_ERRORS, vaultLimits } from "./stellar-vault";

const A = "GBT7ITQKEX3Z2YWIYLPRQ5W3JLA2TJ3JTABB765ZYNG7VLX5YYUPI3DT";
const B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function policy(over: Partial<Policy> = {}): Policy {
  return {
    frozen: false,
    actions: ["swap", "withdraw"],
    confidential: true,
    owner_approval: false,
    assets: [STELLAR_USDC.assetId],
    limits: { per_transaction: { [STELLAR_USDC.assetId]: "100000000" } },
    max_actions_per_hour: 30,
    destinations: {
      mode: "only",
      list: [
        { action: "withdraw", chain: "stellar", address: A, memo: null },
        { action: "withdraw", chain: "near", address: "alice.near", memo: null },
        { action: "withdraw", chain: "stellar", address: A, memo: null },
      ],
    },
    budget: { daily_usd: null, weekly_usd: "20", monthly_usd: null },
    timelock_ms: 0,
    ...over,
  } as Policy;
}

describe("vaultLimits", () => {
  it("takes the caps in USDC's 7-decimal units and only Stellar payees, once each", () => {
    expect(vaultLimits(policy())).toEqual({ perPaymentCap: 100_000_000n, weeklyCap: 200_000_000n, frozen: false, payees: [A] });
  });
  it("carries the pause", () => {
    expect(vaultLimits(policy({ frozen: true })).frozen).toBe(true);
  });
  it("refuses a policy with no weekly limit rather than guessing one", () => {
    expect(() => vaultLimits(policy({ budget: { daily_usd: null, weekly_usd: null, monthly_usd: null } }))).toThrow(/weekly/);
  });
});

describe("payeeDiff", () => {
  it("adds the new and removes the gone", () => {
    expect(payeeDiff([A], [B])).toEqual({ add: [A], remove: [B] });
    expect(payeeDiff([A, B], [A, B])).toEqual({ add: [], remove: [] });
  });
});

describe("refusalForVaultError", () => {
  it("maps each contract error to the NEAR edition's codes", () => {
    expect(refusalForVaultError(VAULT_ERRORS.Frozen).code).toBe("wallet_frozen");
    expect(refusalForVaultError(VAULT_ERRORS.NotPayee).code).toBe("policy_destination_denied");
    expect(refusalForVaultError(VAULT_ERRORS.OverPaymentCap, { perPaymentCap: 100_000_000n }).message).toBe("This is more than your $10.00 limit for a single payment.");
    expect(refusalForVaultError(VAULT_ERRORS.OverWeeklyCap, { weeklyCap: 200_000_000n, spent: 150_000_000n }).message).toBe(
      "This would go over your weekly limit of $20.00 ($5.00 left this week).",
    );
    expect(refusalForVaultError(VAULT_ERRORS.LowBalance).code).toBe("insufficient_balance");
    expect(refusalForVaultError(VAULT_ERRORS.BadAmount).code).toBe("unsupported_token");
  });

  it("explains the vault's balance cap in plain words", () => {
    const r = refusalForVaultError(VAULT_ERRORS.OverMaxBalance);
    expect(r.layer).toBe("balance");
    expect(r.message).toBe("Your Bursr wallet can hold up to $500.00 while its safety contract is being reviewed. Add less.");
  });
});

describe("paymentKey and vaultErrorCode", () => {
  it("gives the same 32 bytes for the same Bursr key", () => {
    expect(paymentKey("plan1:item2").equals(paymentKey("plan1:item2"))).toBe(true);
    expect(paymentKey("plan1:item2")).toHaveLength(32);
    expect(paymentKey("a").equals(paymentKey("b"))).toBe(false);
  });
  it("reads the contract error number from a Soroban error", () => {
    expect(vaultErrorCode("HostError: Error(Contract, #4)\n\nEvent log...")).toBe(4);
    expect(vaultErrorCode("timeout")).toBeNull();
  });
});

describe("test USDC with the wallet's own test XLM", async () => {
  const { planTestUsdc, spendableXlm } = await import("./stellar-vault");
  const X = 10_000_000n;
  it("keeps the network's minimum balance and 1 XLM for fees", () => {
    // 19.49 XLM, 1 trustline already: reserve (2+1)×0.5 = 1.5, fee room 1 → 16.99 spendable.
    expect(spendableXlm(194_943_823n, 1, false)).toBe(169_943_823n);
    expect(spendableXlm(10_000n * X, 0, true)).toBe(10_000n * X - 15n * X / 10n - X);
    expect(spendableXlm(2n * X, 3, false)).toBe(0n);
  });
  it("buys the full amount when the wallet can afford it", () => {
    expect(planTestUsdc({ spendable: 9_000n * X, wanted: 50n * X, xlmForWanted: 70n * X, usdcForSpendable: null })).toEqual({ mode: "receive", usdc: 50n * X, xlmMax: 77n * X });
  });
  it("buys what the wallet can afford otherwise (a wallet with ~17 spendable XLM)", () => {
    const p = planTestUsdc({ spendable: 169_943_823n, wanted: 50n * X, xlmForWanted: 70n * X, usdcForSpendable: 12n * X });
    expect(p).toEqual({ mode: "send", xlm: 169_943_823n, usdcMin: 114_000_000n, usdcExpected: 12n * X });
  });
  it("says so plainly when it can't", () => {
    expect(planTestUsdc({ spendable: X / 2n, wanted: 50n * X, xlmForWanted: 70n * X, usdcForSpendable: null }).mode).toBe("none");
    expect(planTestUsdc({ spendable: 10n * X, wanted: 50n * X, xlmForWanted: null, usdcForSpendable: null }).mode).toBe("none");
  });
});
