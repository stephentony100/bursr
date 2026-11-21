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
  return {
    rpcUrl: env.STELLAR_RPC_URL,
    passphrase: env.STELLAR_NETWORK_PASSPHRASE,
    friendbotUrl: env.STELLAR_FRIENDBOT_URL,
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
export async function fundWithFriendbot(address: string): Promise<void> {
  if (await accountExists(address)) return;
  const res = await fetch(`${stellarConfig().friendbotUrl}?addr=${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(30_000) });
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

async function prepare(tx: Transaction): Promise<Transaction> {
  const sim = await rpcServer().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new StellarSimulationError(sim.error, vaultErrorCode(sim.error));
  return rpc.assembleTransaction(tx, sim).build();
}

/** The owner's vault deploy: one transaction, signed by the owner's wallet, runs the constructor with the rules. */
export async function prepareDeployVault(p: { owner: string; agent: string; perPaymentCap: bigint; weeklyCap: bigint; payees: string[] }): Promise<Transaction> {
  const { wasmHash } = stellarConfig();
  if (!wasmHash) throw new Error("Set STELLAR_VAULT_WASM_HASH in .env (the uploaded vault contract).");
  const tx = (await builder(p.owner))
    .addOperation(
      Operation.createCustomContract({
        address: new Address(p.owner),
        wasmHash: Buffer.from(wasmHash, "hex"),
        salt: randomBytes(32),
        constructorArgs: [sc.address(p.owner), sc.address(p.agent), sc.address(STELLAR_USDC_CONTRACT), sc.i128(p.perPaymentCap), sc.i128(p.weeklyCap), sc.addresses(p.payees)],
      }),
    )
    .build();
  return prepare(tx);
}

/** A transaction from XDR (e.g. signed by the owner's wallet). */
export function txFromXdr(xdrText: string): Transaction {
  const tx = TransactionBuilder.fromXDR(xdrText, stellarConfig().passphrase);
  if (!(tx instanceof Transaction)) throw new Error("Unexpected transaction type.");
  return tx;
}

export type TxResult = { state: "done"; hash: string; returnValue: unknown } | { state: "failed"; hash: string; reason: string } | { state: "pending"; hash: string };

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
    return { state: "done", hash, returnValue: r.returnValue ? scValToNative(r.returnValue) : null };
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
  const horizon = readEnv().STELLAR_HORIZON_URL;
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
