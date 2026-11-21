import type { Policy } from "@near-intents-agent-api/sdk";
import { Keypair } from "@stellar/stellar-sdk";
import { rescale, USD_DECIMALS } from "../money";
import { prepareCall, readContract, rpcServer, sc, signAndSend, StellarSimulationError } from "../stellar";
import { paymentKey, refusalForVaultError, STELLAR_USDC, VAULT_ERRORS } from "../stellar-vault";
import type { ActionRequest } from "./evaluate";
import type { AccountStatus, ActionOutcome, AgentAccount, Outcome } from "./types";

// Live agent account on Stellar (testnet): the business's Soroban vault
// (contracts/bursr-stellar-vault). The agent signs `pay` with its own key, which
// the vault accepts only for approved payees, inside the caps, while not paused,
// and once per payment key. It cannot change any of that: only the owner's
// wallet can (lib/stellar-owner.ts).

export interface StellarVaultConfig {
  vaultId: string;
  agentSecret: string;
  /** The policy the owner last signed (payee names, caps in USD) as Bursr stores it. */
  policy: Policy;
  policyRevision: number;
}

/** The vault's `status()` as scValToNative returns it. */
export interface VaultStatus {
  owner: string;
  agent: string;
  token: string;
  per_payment_cap: bigint;
  weekly_cap: bigint;
  frozen: boolean;
  window_start: bigint;
  spent: bigint;
  balance: bigint;
}

const WEEK_S = 7n * 24n * 60n * 60n;
const ALREADY_PAID = "already-paid:";

export class StellarVaultAccount implements AgentAccount {
  readonly backend = "stellar" as const;
  private readonly agent: Keypair;

  constructor(private readonly cfg: StellarVaultConfig) {
    this.agent = Keypair.fromSecret(cfg.agentSecret);
  }

  vault(): Promise<VaultStatus> {
    return readContract<VaultStatus>(this.cfg.vaultId, "status", [], this.agent.publicKey());
  }

  async status(): Promise<AccountStatus> {
    const v = await this.vault();
    const resets = v.window_start > 0n && v.spent > 0n ? new Date(Number((v.window_start + WEEK_S) * 1000n)) : null;
    return {
      backend: this.backend,
      agentId: this.cfg.vaultId,
      frozen: v.frozen,
      policy: { ...this.cfg.policy, frozen: v.frozen },
      policyRevision: this.cfg.policyRevision,
      spentThisWeekUsd: rescale(BigInt(v.spent), STELLAR_USDC.decimals, USD_DECIMALS),
      weekResetsAt: resets,
      balances: { [STELLAR_USDC.assetId]: BigInt(v.balance) },
    };
  }

  private async pay(req: ActionRequest, key: Buffer, send: boolean): Promise<ActionOutcome> {
    if (req.kind === "swap") {
      return { status: "refused", refusal: { code: "policy_action_denied", layer: "policy", message: "Your Bursr wallet on Stellar pays in USDC only; it doesn't exchange currencies." } };
    }
    if (req.asset !== STELLAR_USDC.assetId) {
      return { status: "refused", refusal: { code: "unsupported_token", layer: "request", message: "Bursr on Stellar pays in USDC only." } };
    }
    let tx;
    try {
      tx = await prepareCall(this.agent.publicKey(), this.cfg.vaultId, "pay", [sc.bytes32(key), sc.address(req.recipient), sc.i128(req.amount)]);
    } catch (e) {
      if (!(e instanceof StellarSimulationError) || e.contractError === null) throw e;
      if (e.contractError === VAULT_ERRORS.AlreadyPaid) return { status: "accepted", correlationId: `${ALREADY_PAID}${key.toString("hex")}`, simulated: false };
      const v = await this.vault().catch(() => null);
      return { status: "refused", refusal: refusalForVaultError(e.contractError, v ? { perPaymentCap: BigInt(v.per_payment_cap), weeklyCap: BigInt(v.weekly_cap), spent: BigInt(v.spent) } : {}) };
    }
    if (!send) return { status: "accepted", correlationId: "preview", simulated: false };
    const hash = await signAndSend(tx, this.agent);
    return { status: "accepted", correlationId: hash, simulated: false };
  }

  execute(req: ActionRequest, idempotencyKey: string): Promise<ActionOutcome> {
    return this.pay(req, paymentKey(idempotencyKey), true);
  }

  preview(req: ActionRequest): Promise<ActionOutcome> {
    return this.pay(req, paymentKey(`preview:${Date.now()}`), false);
  }

  async outcome(correlationId: string): Promise<Outcome> {
    // The vault had already paid this key: an earlier attempt went through.
    if (correlationId.startsWith(ALREADY_PAID)) return { state: "done" };
    const r = await rpcServer().getTransaction(correlationId);
    if (r.status === "SUCCESS") return { state: "done", txHash: correlationId };
    if (r.status === "FAILED") return { state: "failed", txHash: correlationId, reason: "The payment failed on Stellar, so nothing was sent." };
    return { state: "pending", reason: "NOT_FOUND" };
  }
}
