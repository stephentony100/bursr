import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  Operation,
  rpc,
  scValToNative,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { randomBytes } from "node:crypto";
import { readEnv } from "./env";
import { STELLAR_NETWORKS } from "./stellar-network";
import { planTestUsdc, spendableXlm, STELLAR_USDC_CONTRACT, STELLAR_USDC_ISSUER, vaultErrorCode } from "./stellar-vault";
import { fetchJson } from "./http";
import { z } from "zod";

// The one module that talks to the Stellar network (Soroban RPC and friendbot).
// It builds, simulates and submits transactions; it never decides anything.
// Every call has a timeout. Owner transactions are only built here: the
// owner's wallet signs them in the browser.

const TIMEOUT_S = 300;

export function stellarConfig() {
  const env = readEnv();
  const net = STELLAR_NETWORKS[env.STELLAR_NETWORK];
  const rpcUrl = env.STELLAR_RPC_URL ?? net.rpcUrl;
  if (!rpcUrl) throw new Error("Set STELLAR_RPC_URL in .env to a Stellar RPC provider for this network.");
  return {
    network: net,
    rpcUrl,
    passphrase: env.STELLAR_NETWORK_PASSPHRASE ?? net.passphrase,
    horizonUrl: env.STELLAR_HORIZON_URL ?? net.horizonUrl,
    friendbotUrl: env.STELLAR_FRIENDBOT_URL ?? net.friendbotUrl,
    wasmHash: env.STELLAR_VAULT_WASM_HASH,
  };
}

let server: rpc.Server | null = null;
export function rpcServer(): rpc.Server {
  server ??= new rpc.Server(stellarConfig().rpcUrl, { allowHttp: stellarConfig().rpcUrl.startsWith("http://"), timeout: 20_000 });
  return server;
}

export const USDC_ASSET = () => new Asset("USDC", STELLAR_USDC_ISSUER);

/** Arguments for contract calls, typed the way the vault expects. */
export const sc = {
  address: (a: string) => new Address(a).toScVal(),
  i128: (v: bigint) => nativeToScVal(v, { type: "i128" }),
  bool: (v: boolean) => xdr.ScVal.scvBool(v),
  bytes32: (b: Buffer) => xdr.ScVal.scvBytes(b),
  addresses: (list: string[]) => xdr.ScVal.scvVec(list.map((a) => new Address(a).toScVal())),
};

export async function accountExists(address: string): Promise<boolean> {
  try {
    await rpcServer().getAccount(address);
    return true;
  } catch {
    return false;
  }
}

/** Testnet only: gives a new account its starting XLM (for network fees). Safe to call twice. */
/** Testnet only: free test XLM for a new account. Does nothing on mainnet. */
export async function fundWithFriendbot(address: string): Promise<void> {
  const { friendbotUrl } = stellarConfig();
  if (!friendbotUrl) return;
  if (await accountExists(address)) return;
  const res = await fetch(`${friendbotUrl}?addr=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok && !(await accountExists(address))) throw new Error("The Stellar test network didn't fund the new wallet. Please try again in a minute.");
}

/** True when the address can receive USDC (it holds a USDC trustline). */
export async function hasUsdcTrustline(address: string): Promise<boolean> {
  try {
    await rpcServer().getTrustline(address, USDC_ASSET());
    return true;
  } catch {
    return false;
  }
}

/** USDC held by a G-address or a contract, in 7-decimal units. */
export async function usdcBalance(address: string): Promise<bigint> {
  try {
    const r = await rpcServer().getAssetBalance(address, USDC_ASSET(), stellarConfig().passphrase);
    return BigInt(r.balanceEntry?.amount ?? "0");
  } catch {
    return 0n;
  }
}

async function builder(source: string) {
  const account = await rpcServer().getAccount(source);
  return new TransactionBuilder(account, { fee: (Number(BASE_FEE) * 100).toString(), networkPassphrase: stellarConfig().passphrase }).setTimeout(TIMEOUT_S);
}

export class StellarSimulationError extends Error {
  constructor(
    message: string,
    readonly contractError: number | null,
  ) {
    super(message);
    this.name = "StellarSimulationError";
  }
}

/** Reads a contract function without sending anything (any funded source works). */
export async function readContract<T>(contractId: string, method: string, args: xdr.ScVal[] = [], source?: string): Promise<T> {
  const from = source ?? Keypair.random().publicKey();
  // A read needs a source account only to form the transaction; it doesn't have to exist.
  const tx = new TransactionBuilder(new Account(from, "0"), { fee: BASE_FEE, networkPassphrase: stellarConfig().passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(TIMEOUT_S)
    .build();
  const sim = await rpcServer().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new StellarSimulationError(sim.error, vaultErrorCode(sim.error));
  if (!sim.result) throw new Error(`Stellar returned no result for ${method}.`);
  return scValToNative(sim.result.retval) as T;
}

/** Builds a contract call from `source`, simulated and ready to sign. Refusals by the contract throw StellarSimulationError. */
export async function prepareCall(source: string, contractId: string, method: string, args: xdr.ScVal[]): Promise<Transaction> {
  const tx = (await builder(source)).addOperation(new Contract(contractId).call(method, ...args)).build();
  return prepare(tx);
}

async function prepare(tx: Transaction, authMode?: rpc.Api.SimulationAuthMode): Promise<Transaction> {
  const sim = await rpcServer().simulateTransaction(tx, undefined, authMode);
  if (rpc.Api.isSimulationError(sim)) throw new StellarSimulationError(sim.error, vaultErrorCode(sim.error));
  return rpc.assembleTransaction(tx, sim).build();
}

/**
 * The owner's vault deploy: one transaction runs the constructor with the rules,
 * which the owner signs. A wallet owner sends it themselves; a passkey owner's
 * deploy is sent (and paid for) by `deployer`, Bursr's fee account.
 */
export async function prepareDeployVault(p: { owner: string; agent: string; perPaymentCap: bigint; weeklyCap: bigint; payees: string[]; deployer?: string }): Promise<Transaction> {
  const { wasmHash } = stellarConfig();
  if (!wasmHash) throw new Error("Set STELLAR_VAULT_WASM_HASH in .env (the uploaded vault contract).");
  const deployer = p.deployer ?? p.owner;
  const tx = (await builder(deployer))
    .addOperation(
      Operation.createCustomContract({
        address: new Address(deployer),
        wasmHash: Buffer.from(wasmHash, "hex"),
        salt: randomBytes(32),
        constructorArgs: [sc.address(p.owner), sc.address(p.agent), sc.address(STELLAR_USDC_CONTRACT), sc.i128(p.perPaymentCap), sc.i128(p.weeklyCap), sc.addresses(p.payees)],
      }),
    )
    .build();
  // Another deployer means the owner's approval is non-root (see prepareFeePaid).
  return prepare(tx, deployer === p.owner ? undefined : "record_allow_nonroot");
}

/** A transaction from XDR (e.g. signed by the owner's wallet). */
export function txFromXdr(xdrText: string): Transaction {
  const tx = TransactionBuilder.fromXDR(xdrText, stellarConfig().passphrase);
  if (!(tx instanceof Transaction)) throw new Error("Unexpected transaction type.");
  return tx;
}

export type TxResult = { state: "done"; hash: string; returnValue: unknown; ledger: number } | { state: "failed"; hash: string; reason: string } | { state: "pending"; hash: string };

/** Sends a signed transaction. Doesn't wait for it to land; see waitForTx. */
export async function submit(tx: Transaction): Promise<string> {
  const sent = await rpcServer().sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error(`Stellar refused the transaction (${sent.errorResult?.toXDR("base64") ?? "error"}).`);
  return sent.hash;
}

/** Follows a transaction for up to `attempts` seconds. */
export async function waitForTx(hash: string, attempts = 30): Promise<TxResult> {
  const r = await rpcServer().pollTransaction(hash, { attempts, sleepStrategy: () => 1000 });
  if (r.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    return { state: "done", hash, returnValue: r.returnValue ? scValToNative(r.returnValue) : null, ledger: r.ledger };
  }
  if (r.status === rpc.Api.GetTransactionStatus.FAILED) return { state: "failed", hash, reason: "The transaction failed on Stellar." };
  return { state: "pending", hash };
}

/** Signs with a server-held key (the agent's), sends and waits. */
export async function signAndSend(tx: Transaction, signer: Keypair): Promise<string> {
  tx.sign(signer);
  return submit(tx);
}

/**
 * Testnet only: one transaction, signed by the owner's wallet, that lets their
 * wallet hold USDC (a trustline, if missing) and buys test USDC with its own
 * test XLM on the testnet exchange: `usdc` (7-decimal units) when the wallet
 * can afford it, otherwise as much as its spendable XLM buys (planTestUsdc).
 * Returns the transaction and the USDC the owner should expect.
 */
export async function prepareGetTestUsdc(owner: string, usdc: bigint): Promise<{ tx: Transaction; usdcExpected: bigint }> {
  const horizon = stellarConfig().horizonUrl;
  const usdcParam = `USDC:${STELLAR_USDC_ISSUER}`;
  const account = await fetchJson(`${horizon}/accounts/${owner}`, HorizonAccount);
  const native = account.balances.find((b) => b.asset_type === "native");
  const addsTrustline = !(await hasUsdcTrustline(owner));
  const spendable = spendableXlm(parseStroops(native?.balance ?? "0"), account.subentry_count, addsTrustline);

  const receive = await fetchJson(`${horizon}/paths/strict-receive?source_assets=native&destination_asset_type=credit_alphanum4&destination_asset_code=USDC&destination_asset_issuer=${STELLAR_USDC_ISSUER}&destination_amount=${formatStroops(usdc)}`, HorizonPaths).catch(() => null);
  const xlmForWanted = receive?._embedded.records.length ? minBig(receive._embedded.records.map((r) => parseStroops(r.source_amount))) : null;
  let usdcForSpendable: bigint | null = null;
  if (spendable > 0n && (xlmForWanted === null || (xlmForWanted * 11n) / 10n > spendable)) {
    const send = await fetchJson(`${horizon}/paths/strict-send?source_asset_type=native&source_amount=${formatStroops(spendable)}&destination_assets=${usdcParam}`, HorizonPaths).catch(() => null);
    usdcForSpendable = send?._embedded.records.length ? maxBig(send._embedded.records.map((r) => parseStroops(r.destination_amount))) : null;
  }
  const plan = planTestUsdc({ spendable, wanted: usdc, xlmForWanted, usdcForSpendable });
  if (plan.mode === "none") throw new Error(plan.reason);

  const b = await builder(owner);
  if (addsTrustline) b.addOperation(Operation.changeTrust({ asset: USDC_ASSET() }));
  if (plan.mode === "receive") {
    b.addOperation(Operation.pathPaymentStrictReceive({ sendAsset: Asset.native(), sendMax: formatStroops(plan.xlmMax), destination: owner, destAsset: USDC_ASSET(), destAmount: formatStroops(plan.usdc), path: [] }));
    return { tx: b.build(), usdcExpected: plan.usdc };
  }
  b.addOperation(Operation.pathPaymentStrictSend({ sendAsset: Asset.native(), sendAmount: formatStroops(plan.xlm), destination: owner, destAsset: USDC_ASSET(), destMin: formatStroops(plan.usdcMin), path: [] }));
  return { tx: b.build(), usdcExpected: plan.usdcExpected };
}

const HorizonAccount = z.object({ subentry_count: z.number(), balances: z.array(z.object({ asset_type: z.string(), balance: z.string() })) });
const HorizonPaths = z.object({ _embedded: z.object({ records: z.array(z.object({ source_amount: z.string(), destination_amount: z.string() })) }) });
const minBig = (xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));
const maxBig = (xs: bigint[]) => xs.reduce((a, b) => (b > a ? b : a));

/** "12.5000000" (7 decimals, as Horizon and classic operations write amounts) ⇄ 7-decimal units. */
function parseStroops(s: string): bigint {
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * 10_000_000n + BigInt((frac + "0000000").slice(0, 7));
}

function formatStroops(v: bigint): string {
  const s = v.toString().padStart(8, "0");
  return `${s.slice(0, -7)}.${s.slice(-7)}`;
}

// --- Bursr's fee account (passkey owners) ---
// A passkey owner's account is a contract, and "contract accounts can't sign
// transaction envelopes, so a separate G-account must act as the transaction
// source" (developers.stellar.org fee-sponsorship). Bursr's fee account is
// that source: it pays the fee; the owner's passkey signs only their own
// authorization entries. It holds a little XLM, never business money.

export function feeKeypair(): Keypair {
  const secret = readEnv().STELLAR_FEE_SECRET;
  if (!secret) throw new Error("Set STELLAR_FEE_SECRET in .env (Bursr's Stellar fee account).");
  return Keypair.fromSecret(secret);
}

/** The address an authorization entry asks to sign for, or null for the transaction source's own entry. */
export function entryAddress(entry: xdr.SorobanAuthorizationEntry): string | null {
  const c = entry.credentials;
  if (c.type === "sorobanCredentialsAddress") return Address.fromScAddress(c.address.address).toString();
  if (c.type === "sorobanCredentialsAddressV2") return Address.fromScAddress(c.addressV2.address).toString();
  return null;
}

function invokeOp(tx: Transaction): Operation.InvokeHostFunction {
  const op = tx.operations[0];
  if (tx.operations.length !== 1 || op?.type !== "invokeHostFunction") throw new Error("Expected one contract call.");
  return op as Operation.InvokeHostFunction;
}

/** The entries in a simulated transaction that `signer` must sign, as base64 (for the passkey kit). */
export function entriesFor(tx: Transaction, signer: string): string[] {
  return (invokeOp(tx).auth ?? []).filter((e) => entryAddress(e) === signer).map((e) => e.toXdr("base64"));
}

/**
 * A contract call (or a vault deploy) paid for by the fee account, simulated,
 * with the entries others must sign. In a deploy the owner's approval sits
 * under the fee account's create-contract call (a "non-root" approval), which
 * plain recording refuses (Error(Context, InvalidAction)), so this records
 * with `record_allow_nonroot`. The send (submitFeePaid) re-simulates with the
 * real signatures, which the network checks.
 */
export async function prepareFeePaid(op: xdr.Operation): Promise<Transaction> {
  return prepare((await builder(feeKeypair().publicKey())).addOperation(op).build(), "record_allow_nonroot");
}

/**
 * Sends a call whose approvals are already signed (the passkey account's
 * deploy from the kit), paid by the fee account. Simulation then checks the
 * signatures as they are: recording modes refuse a transaction that already
 * has approvals ("cannot set authMode … with an auth footprint").
 */
export async function sendFeePaid(op: xdr.Operation): Promise<string> {
  const ready = await prepare((await builder(feeKeypair().publicKey())).addOperation(op).build());
  ready.sign(feeKeypair());
  return submit(ready);
}

/**
 * Swaps in the signed entries Bursr asked for (same invocation, same signer,
 * same nonce: anything else is refused), re-simulates (a passkey signature is
 * larger than the placeholder, and simulation checks it), signs with the fee
 * account and sends. Returns the hash.
 */
export async function submitFeePaid(prepared: Transaction, signer: string, signed: string[]): Promise<string> {
  const op = invokeOp(prepared);
  const want = entriesFor(prepared, signer).map((b) => xdr.SorobanAuthorizationEntry.fromXdr(b, "base64"));
  const got = signed.map((b) => xdr.SorobanAuthorizationEntry.fromXdr(b, "base64"));
  if (got.length !== want.length) throw new Error("The passkey signed a different number of approvals than Bursr asked for.");
  const nonce = (e: xdr.SorobanAuthorizationEntry) => {
    const c = e.credentials;
    return c.type === "sorobanCredentialsAddress" ? c.address.nonce : c.type === "sorobanCredentialsAddressV2" ? c.addressV2.nonce : null;
  };
  want.forEach((w, i) => {
    const g = got[i];
    if (entryAddress(g) !== signer || nonce(g) !== nonce(w) || g.rootInvocation.toXdr("base64") !== w.rootInvocation.toXdr("base64")) {
      throw new Error("The passkey signed something other than what Bursr prepared.");
    }
  });
  let next = 0;
  const auth = (op.auth ?? []).map((e) => (entryAddress(e) === signer ? got[next++] : e));
  const rebuilt = (await builder(feeKeypair().publicKey())).addOperation(Operation.invokeHostFunction({ func: op.func, auth })).build();
  const ready = await prepare(rebuilt);
  ready.sign(feeKeypair());
  return submit(ready);
}

/** Starts a new account (the agent's) with a little XLM for its own fees: friendbot on testnet, the fee account on mainnet. */
export async function startAccount(address: string, xlm = "3"): Promise<void> {
  if (await accountExists(address)) return;
  if (stellarConfig().friendbotUrl) return fundWithFriendbot(address);
  const tx = (await builder(feeKeypair().publicKey())).addOperation(Operation.createAccount({ destination: address, startingBalance: xlm })).build();
  const hash = await signAndSend(tx, feeKeypair());
  const r = await waitForTx(hash, 40);
  if (r.state !== "done") throw new Error("Stellar didn't open the agent's account. Please try again in a minute.");
}
