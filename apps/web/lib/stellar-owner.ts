import type { Policy } from "@near-intents-agent-api/sdk";
import { Contract, Keypair, type Transaction, type xdr } from "@stellar/stellar-sdk";
import type { PrismaClient } from "./generated/prisma/client";
import { dataKey, sealGrant } from "./grant-store";
import { isOwnerSession, type OwnerSession } from "./owner";
import { ownerAddress, ownerChain } from "./owner-id";
import { desiredPolicy, NotOwnerError, setFrozen } from "./owner-actions";
import { readEnv } from "./env";
import { formatUsd, rescale, USD_DECIMALS } from "./money";
import { entriesFor, feeKeypair, prepareFeePaid, rpcServer, startAccount, submitFeePaid, fundWithFriendbot, stellarConfig, prepareCall, prepareGetTestUsdc, prepareDeployVault, sc, submit, txFromXdr, usdcBalance, waitForTx, StellarSimulationError } from "./stellar";
import { payeeDiff, refusalForVaultError, vaultLimits } from "./stellar-vault";
import { getAccountRecord, getBusiness } from "./store";
import { trustSignedPayees } from "./trust";

// Owner actions in the Stellar edition. Same four steps as the NEAR edition's
// owner intents: Bursr's server builds the transaction, the owner signs it in
// the browser, the server checks it is the very transaction it built and
// sends it, then follows it to the end. The server never holds the owner's
// key; the agent's key can't do any of these.
// - Wallet owner (G…): their Stellar wallet signs and pays for the whole transaction.
// - Passkey owner (C…, a passkey account): Bursr's fee account is the source and
//   pays; the owner's passkey signs only their own approval (auth entry).

export type StellarOwnerKind = "agent_create" | "policy_update" | "agent_freeze" | "agent_unfreeze" | "fund" | "withdraw" | "test_usdc" | "cash_out";

const WORDS: Record<StellarOwnerKind, string> = {
  agent_create: "You set up your Bursr wallet on Stellar with your spending rules",
  policy_update: "You confirmed your new spending rules with your wallet",
  agent_freeze: "You paused all payments",
  agent_unfreeze: "You turned payments back on",
  fund: "You added money to your Bursr wallet",
  withdraw: "You moved money back to your own wallet",
  test_usdc: "You got test USDC for your own wallet",
  cash_out: "You sent USDC from your Bursr wallet to cash out to your bank",
};

const SUMMARY: Record<StellarOwnerKind, string> = {
  agent_create: "Create your Bursr wallet on Stellar with your limits and the people you pay",
  policy_update: "Update the limits and the people your Bursr wallet may pay",
  agent_freeze: "Pause all payments from your Bursr wallet",
  agent_unfreeze: "Turn payments from your Bursr wallet back on",
  fund: "Add USDC to your Bursr wallet",
  withdraw: "Move USDC from your Bursr wallet back to your own wallet",
  test_usdc: "Get test USDC in your own wallet, paid for with free test XLM",
  cash_out: "Send USDC from your Bursr wallet to be paid out to your bank",
};

/** The browser-facing shape (components/wallet.ts PreparedIntent), with the transaction to sign. */
export interface PreparedStellarTx {
  kind: StellarOwnerKind;
  correlationId: string;
  agentId: string;
  expiresAt: string;
  summary: string;
  policy?: Policy;
  intent:
    | { standard: "stellar-xdr"; payload: { xdr: string; networkPassphrase: string; address: string } }
    | { standard: "stellar-auth"; payload: { entries: string[]; networkPassphrase: string; address: string; expiration: number; credentialId?: string } };
}

interface Pending {
  kind: StellarOwnerKind;
  ownerId: string;
  policy?: Policy;
  agentSecret?: string;
  /** Passkey owners: the fee-paid transaction whose entries the passkey signs. */
  txXdr?: string;
  /** cash_out: the naira order this pays (lib/ramp-orders.ts). */
  orderId?: string;
  expiresAt: number;
}

/** A passkey owner's ID holds their passkey account (a contract, C…), not a wallet (G…). */
export function isPasskeyOwnerAddress(address: string): boolean {
  return address.startsWith("C");
}

// What each prepared transaction is for, by its hash, for the few minutes it is
// valid. The new agent key waits here until the owner's vault exists, then it is
// sealed into the database (lib/grant-store.ts) and never shown to anyone.
const pending = new Map<string, Pending>();

export function isStellarEdition(): boolean {
  const env = readEnv();
  return env.BURSAR_MODE === "live" && env.BURSR_CHAIN === "stellar";
}

export async function assertStellarOwner(db: PrismaClient, owner: OwnerSession) {
  if (!isOwnerSession(owner) || owner.demo) throw new NotOwnerError("Sign in with your wallet first.");
  if (ownerChain(owner.accountId) !== "stellar") throw new NotOwnerError("Sign in with a Stellar wallet.");
  const business = await getBusiness(db);
  if (!business || business.ownerAccountId !== owner.accountId) throw new NotOwnerError();
  return { business, address: ownerAddress(owner.accountId) };
}

// About 10 minutes of ledgers for a passkey approval to be used.
const APPROVAL_LEDGERS = 120;

async function prepared(kind: StellarOwnerKind, tx: Transaction, agentId: string, address: string, entry: Omit<Pending, "kind" | "expiresAt" | "txXdr">): Promise<PreparedStellarTx> {
  const correlationId = Buffer.from(tx.hash()).toString("hex");
  const expiresAt = Date.now() + 4 * 60 * 1000;
  const networkPassphrase = stellarConfig().passphrase;
  const base = { kind, correlationId, agentId, expiresAt: new Date(expiresAt).toISOString(), summary: SUMMARY[kind], policy: entry.policy };
  if (isPasskeyOwnerAddress(address)) {
    pending.set(correlationId, { kind, expiresAt, ...entry, txXdr: tx.toXDR() });
    const expiration = (await rpcServer().getLatestLedger()).sequence + APPROVAL_LEDGERS;
    return { ...base, intent: { standard: "stellar-auth", payload: { entries: entriesFor(tx, address), networkPassphrase, address, expiration } } };
  }
  pending.set(correlationId, { kind, expiresAt, ...entry });
  return { ...base, intent: { standard: "stellar-xdr", payload: { xdr: tx.toXDR(), networkPassphrase, address } } };
}

/** A vault call from the owner: their wallet sends it, or Bursr's fee account does for a passkey owner. */
function ownerCall(address: string, contractId: string, method: string, args: xdr.ScVal[]): Promise<Transaction> {
  if (isPasskeyOwnerAddress(address)) return prepareFeePaid(new Contract(contractId).call(method, ...args));
  return prepareCall(address, contractId, method, args);
}

/** Turns a refusal from simulation into the owner's words (e.g. withdrawing more than the vault holds). */
function ownerError(e: unknown): never {
  if (e instanceof StellarSimulationError && e.contractError !== null) throw new Error(refusalForVaultError(e.contractError).message);
  throw e;
}

/** Prepares an owner action; a passkey owner's request also names their passkey, so the device asks for it straight away. */
export async function prepareStellarOwnerTx(
  db: PrismaClient,
  owner: OwnerSession,
  kind: StellarOwnerKind,
  opts: { amount?: bigint; orderId?: string } = {},
): Promise<PreparedStellarTx> {
  const out = await prepareOwnerTx(db, owner, kind, opts);
  if (out.intent.standard === "stellar-auth") {
    const pk = await db.stellarPasskey.findFirst({ where: { contractId: out.intent.payload.address, status: "ready" }, orderBy: { lastUsedAt: "desc" } });
    if (pk) out.intent.payload.credentialId = pk.credentialId;
  }
  return out;
}

async function prepareOwnerTx(
  db: PrismaClient,
  owner: OwnerSession,
  kind: StellarOwnerKind,
  opts: { amount?: bigint; orderId?: string } = {},
): Promise<PreparedStellarTx> {
  const { address } = await assertStellarOwner(db, owner);
  const record = await getAccountRecord(db);
  const passkey = isPasskeyOwnerAddress(address);
  if (!passkey) await fundWithFriendbot(address);

  if (kind === "agent_create") {
    if (record) throw new Error("This business already has a Bursr wallet.");
    dataKey(); // fail before the owner signs if the agent's key couldn't be stored
    const policy = (await desiredPolicy(db))!;
    const limits = vaultLimits(policy);
    const agent = Keypair.random();
    await startAccount(agent.publicKey()); // the agent pays its own network fees
    const deployer = passkey ? feeKeypair().publicKey() : undefined;
    const tx = await prepareDeployVault({ owner: address, agent: agent.publicKey(), perPaymentCap: limits.perPaymentCap, weeklyCap: limits.weeklyCap, payees: limits.payees, deployer });
    return await prepared(kind, tx, "new", address, { ownerId: owner.accountId, policy, agentSecret: agent.secret() });
  }

  if (kind === "test_usdc") {
    if (stellarConfig().network.name !== "testnet" || passkey) throw new Error("Test USDC is only for practice with a Stellar test wallet.");
    const amount = opts.amount ?? 0n;
    if (amount <= 0n || amount > 500_0000000n) throw new Error("Ask for between $1 and $500 of test USDC.");
    const { tx, usdcExpected } = await prepareGetTestUsdc(address, amount);
    const p = await prepared(kind, tx, record?.agentId ?? "new", address, { ownerId: owner.accountId });
    return { ...p, summary: `Get about ${formatUsd(rescale(usdcExpected, 7, USD_DECIMALS))} of test USDC in your own wallet, paid for with its free test XLM` };
  }

  if (!record || record.backend !== "stellar") throw new Error("Set up your Bursr wallet first.");
  const vault = record.agentId;
  try {
    if (kind === "policy_update") {
      const policy = (await desiredPolicy(db))!;
      const want = vaultLimits(policy);
      // Adding a payee twice is harmless, so every wanted payee is (re)added; only the gone are removed.
      const { remove } = payeeDiff(want.payees, vaultLimits(record.policy).payees);
      const tx = await ownerCall(address, vault, "update", [sc.i128(want.perPaymentCap), sc.i128(want.weeklyCap), sc.bool(want.frozen), sc.addresses(want.payees), sc.addresses(remove)]);
      return await prepared(kind, tx, vault, address, { ownerId: owner.accountId, policy });
    }
    if (kind === "agent_freeze" || kind === "agent_unfreeze") {
      // Only the pause changes: the limits and payees stay as last signed.
      const now = vaultLimits(record.policy);
      const tx = await ownerCall(address, vault, "update", [sc.i128(now.perPaymentCap), sc.i128(now.weeklyCap), sc.bool(kind === "agent_freeze"), sc.addresses([]), sc.addresses([])]);
      return await prepared(kind, tx, vault, address, { ownerId: owner.accountId, policy: { ...record.policy, frozen: kind === "agent_freeze" } });
    }
    if (kind === "cash_out") {
      // One vault payment to the naira provider's one-time address, paid once (its key comes from the order).
      const { cashOutPayment } = await import("./ramp-orders");
      const pay = await cashOutPayment(db, opts.orderId ?? "");
      const tx = await ownerCall(address, vault, "owner_pay", [sc.payouts([pay])]);
      const p = await prepared(kind, tx, vault, address, { ownerId: owner.accountId, orderId: opts.orderId });
      return p;
    }
    const amount = opts.amount ?? 0n;
    if (amount <= 0n) throw new Error("Enter an amount more than zero.");
    if (kind === "fund") {
      const held = await usdcBalance(address);
      if (held < amount) throw new Error(passkey ? "Your passkey account doesn't hold that much USDC. Add less." : "Your Stellar wallet doesn't hold that much USDC. Get test USDC from Circle's faucet, or add less.");
      // Through the vault's deposit, so its balance cap applies.
      const tx = await ownerCall(address, vault, "deposit", [sc.address(address), sc.i128(amount)]);
      return await prepared(kind, tx, vault, address, { ownerId: owner.accountId });
    }
    const tx = await ownerCall(address, vault, "withdraw", [sc.address(address), sc.i128(amount)]);
    return await prepared(kind, tx, vault, address, { ownerId: owner.accountId });
  } catch (e) {
    ownerError(e);
  }
}

export interface StellarSubmitResult {
  status: "SUCCESS" | "FAILED" | "REFUSED";
  failureCode: string | null;
  txHash?: string;
}

export async function submitStellarOwnerTx(
  db: PrismaClient,
  owner: OwnerSession,
  p: { correlationId: string; signedXdr?: string; signedEntries?: string[] },
): Promise<StellarSubmitResult> {
  const { address } = await assertStellarOwner(db, owner);
  const entry = pending.get(p.correlationId);
  if (!entry || entry.expiresAt < Date.now() || entry.ownerId !== owner.accountId) {
    return { status: "FAILED", failureCode: "This confirmation ran out of time. Please press the button again." };
  }
  let hash: string;
  if (entry.txXdr) {
    // Passkey owner: only their approvals come back; Bursr's fee account sends.
    if (!p.signedEntries) return { status: "REFUSED", failureCode: "Your passkey didn't send back its approval." };
    pending.delete(p.correlationId);
    try {
      hash = await submitFeePaid(txFromXdr(entry.txXdr), address, p.signedEntries);
    } catch (e) {
      return { status: "REFUSED", failureCode: e instanceof Error ? e.message : "Your passkey's approval wasn't accepted." };
    }
  } else {
    let tx: Transaction;
    try {
      tx = txFromXdr(p.signedXdr ?? "");
    } catch {
      return { status: "REFUSED", failureCode: "Your wallet sent back something Bursr didn't ask for." };
    }
    // Only the exact transaction Bursr built (signatures aside) may be sent.
    if (Buffer.from(tx.hash()).toString("hex") !== p.correlationId) return { status: "REFUSED", failureCode: "Your wallet signed a different transaction than the one Bursr prepared." };
    pending.delete(p.correlationId);
    hash = await submit(tx);
  }
  const r = await waitForTx(hash, 40);
  if (r.state !== "done") return { status: "FAILED", failureCode: r.state === "failed" ? r.reason : "Stellar is slow to confirm. Check again in a minute.", txHash: hash };

  const kind = entry.kind;
  if (kind === "agent_create") {
    const vaultId = String(r.returnValue);
    await db.agentAccount.create({
      data: {
        backend: "stellar",
        agentId: vaultId,
        policy: JSON.stringify(entry.policy),
        policyRevision: 1,
        grantSealed: sealGrant(entry.agentSecret!, vaultId, dataKey()),
        grantExpiresAt: null,
      },
    });
  } else if (kind === "policy_update" || kind === "agent_freeze" || kind === "agent_unfreeze") {
    if (kind !== "policy_update") await setFrozen(db, owner, kind === "agent_freeze");
    await db.agentAccount.update({
      where: { id: "main" },
      data: { policy: JSON.stringify(entry.policy), policyRevision: { increment: 1 }, signedAt: new Date() },
    });
  }
  // The owner's wallet just signed the payee list: that is their OK for each person's first payment too.
  if (kind === "agent_create" || kind === "policy_update") await trustSignedPayees(db);
  if (kind === "cash_out" && entry.orderId) await (await import("./ramp-orders")).cashOutSent(db, owner, entry.orderId, hash);
  await db.auditEvent.create({
    data: { kind: `owner_${kind}`, actor: owner.accountId, message: WORDS[kind], data: JSON.stringify({ txHash: hash }) },
  });
  return { status: "SUCCESS", failureCode: null, txHash: hash };
}
