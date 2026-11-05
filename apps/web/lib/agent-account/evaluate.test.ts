import { describe, expect, it } from "vitest";
import { demoTronAddress } from "../demo-addresses";
import { buildPolicy } from "../policy";
import { BASE_PAYEE, NEAR_PAYEE, TRON_PAYEE, USDC_BASE, USDC_NEAR, USDT_TRON, rules } from "../test-fixtures";
import { evaluate, spentThisWeek, weekPeriodStart, type AccountState, type ActionRequest } from "./evaluate";

const M = 1_000_000n; // one dollar in 6-decimal units
const START = new Date("2026-11-02T08:00:00Z"); // weekly cap turned on
const NOW = new Date("2026-11-06T12:00:00Z");

function state(over: Partial<AccountState> = {}, rulesOver = {}): AccountState {
  return {
    policy: buildPolicy(rules(rulesOver), [NEAR_PAYEE, TRON_PAYEE, BASE_PAYEE]),
    budgetStartedAt: START,
    spends: [],
    balances: { [USDC_NEAR.assetId]: 5_000n * M, [USDT_TRON.assetId]: 500n * M, [USDC_BASE.assetId]: 500n * M },
    decimals: { [USDC_NEAR.assetId]: 6, [USDT_TRON.assetId]: 6, [USDC_BASE.assetId]: 6 },
    ...over,
  };
}

const payTron = (dollars: bigint): ActionRequest => ({
  kind: "withdraw",
  asset: USDT_TRON.assetId,
  amount: dollars * M,
  chain: "tron",
  recipient: TRON_PAYEE.payout.address,
});

const code = (s: AccountState, r: ActionRequest, now = NOW) => {
  const v = evaluate(s, r, now);
  return v.ok ? "ok" : v.refusal.code;
};

describe("agent account rules (dry-run simulator)", () => {
  it("allows a payment to a listed payee inside every limit", () => {
    const v = evaluate(state(), payTron(100n), NOW);
    expect(v).toEqual({ ok: true, usdMicros: 100n * M });
  });

  describe("payee allowlist", () => {
    it("refuses an address that is not on the owner's list", () => {
      const r = { ...payTron(10n), recipient: demoTronAddress("attacker") } as ActionRequest;
      expect(code(state(), r)).toBe("policy_destination_denied");
    });

    it("refuses a listed address on a different chain", () => {
      const r = { ...payTron(10n), chain: "base" } as ActionRequest;
      expect(code(state(), r)).toBe("policy_destination_denied");
    });

    it("refuses a listed address with a memo the owner did not list", () => {
      const r = { ...payTron(10n), memo: "123" } as ActionRequest;
      expect(code(state(), r)).toBe("policy_destination_denied");
    });

    it("matches EVM addresses case-insensitively, as stored lowercase", () => {
      const r: ActionRequest = {
        kind: "withdraw",
        asset: USDC_BASE.assetId,
        amount: 10n * M,
        chain: "base",
        recipient: BASE_PAYEE.payout.address, // mixed case
      };
      expect(code(state(), r)).toBe("ok");
    });

    it("refuses everything when the owner has listed no payees", () => {
      const toFarm: ActionRequest = { kind: "withdraw", asset: USDC_NEAR.assetId, amount: M, chain: "near", recipient: "farm.near" };
      expect(code(state(), toFarm)).toBe("ok");
      expect(code(state({ policy: buildPolicy(rules(), []) }), toFarm)).toBe("policy_destination_denied");
    });

    it("refuses plain transfers (only withdrawals to listed payees are allowed)", () => {
      const r: ActionRequest = { kind: "transfer", asset: USDC_NEAR.assetId, amount: M, recipient: "farm.near" };
      expect(code(state(), r)).toBe("policy_action_denied");
    });
  });

  describe("per-payment cap", () => {
    it("allows a payment exactly at the cap", () => {
      expect(code(state(), payTron(400n))).toBe("ok");
    });

    it("refuses a payment one unit above the cap", () => {
      const r = { ...payTron(400n), amount: 400n * M + 1n } as ActionRequest;
      const v = evaluate(state(), r, NOW);
      expect(v.ok).toBe(false);
      if (!v.ok) {
        expect(v.refusal.code).toBe("policy_transaction_limit_exceeded");
        expect(v.refusal.message).toContain("$400.00");
      }
    });
  });

  describe("weekly cap", () => {
    const spent = (dollars: bigint, at = new Date("2026-11-05T10:00:00Z")) => [{ at, usdMicros: dollars * M }];

    it("allows spending up to the weekly cap", () => {
      expect(code(state({ spends: spent(600n) }), payTron(400n))).toBe("ok");
    });

    it("refuses a payment that would go over the weekly cap", () => {
      const v = evaluate(state({ spends: spent(700n) }), payTron(301n), NOW);
      expect(v.ok).toBe(false);
      if (!v.ok) {
        expect(v.refusal.code).toBe("spend_budget_exceeded");
        expect(v.refusal.message).toContain("$300.00 left");
      }
    });

    it("forgets spending from an earlier 7-day period", () => {
      const lastWeek = spent(1000n, new Date("2026-11-01T10:00:00Z"));
      expect(code(state({ spends: lastWeek }), payTron(400n))).toBe("ok");
    });

    it("periods are fixed from when the cap was turned on, not calendar weeks", () => {
      expect(weekPeriodStart(START, new Date("2026-11-09T07:59:59Z"))).toEqual(START);
      expect(weekPeriodStart(START, new Date("2026-11-09T08:00:00Z"))).toEqual(new Date("2026-11-09T08:00:00Z"));
      const s = state({ spends: spent(900n, new Date("2026-11-09T07:00:00Z")) });
      expect(spentThisWeek(s, new Date("2026-11-09T09:00:00Z"))).toBe(0n);
    });

    it("a cap of zero allows nothing", () => {
      const s = state({ policy: { ...state().policy, budget: { daily_usd: null, weekly_usd: "0", monthly_usd: null } } });
      expect(code(s, payTron(1n))).toBe("spend_budget_exceeded");
    });

    it("swaps stay inside the account and do not count against the weekly cap", () => {
      const swap: ActionRequest = { kind: "swap", asset: USDC_NEAR.assetId, amount: 300n * M, destinationAsset: USDT_TRON.assetId };
      expect(code(state({ spends: spent(1000n) }), swap)).toBe("ok");
    });
  });

  describe("freeze", () => {
    it("refuses every action while frozen", () => {
      const s = state({}, { frozen: true });
      expect(code(s, payTron(1n))).toBe("wallet_frozen");
      expect(code(s, { kind: "swap", asset: USDC_NEAR.assetId, amount: M, destinationAsset: USDT_TRON.assetId })).toBe("wallet_frozen");
    });

    it("allows the same payment once unfrozen", () => {
      expect(code(state({}, { frozen: false }), payTron(1n))).toBe("ok");
    });
  });

  describe("allowed tokens", () => {
    it("refuses spending a token the owner did not allow", () => {
      const other = "nep141:usdt.tether-token.near";
      const s = state({ decimals: { ...state().decimals, [other]: 6 }, balances: { [other]: 100n * M } });
      expect(code(s, { ...payTron(10n), asset: other } as ActionRequest)).toBe("policy_asset_denied");
    });

    it("refuses swapping into a token the owner did not allow", () => {
      const swap: ActionRequest = { kind: "swap", asset: USDC_NEAR.assetId, amount: M, destinationAsset: "nep141:wrap.near" };
      expect(code(state(), swap)).toBe("policy_asset_denied");
    });
  });

  describe("balance", () => {
    it("refuses a payment larger than the balance", () => {
      expect(code(state({ balances: { [USDT_TRON.assetId]: 5n * M } }), payTron(10n))).toBe("insufficient_balance");
    });
  });

  it("refuses zero amounts and unknown tokens", () => {
    expect(code(state(), { ...payTron(0n) } as ActionRequest)).toBe("unsupported_token");
    expect(code(state(), { ...payTron(1n), asset: "nep141:unknown" } as ActionRequest)).toBe("unsupported_token");
  });
});
