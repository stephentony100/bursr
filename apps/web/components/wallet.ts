"use client";

import type { NearConnector } from "@hot-labs/near-connect";
import type { DAppKit, UiWallet } from "@mysten/dapp-kit-core";
import { friendlyError } from "@/lib/errors";

// One wallet connection for the whole app (HOT and other NEAR wallets via
// @hot-labs/near-connect). The owner's key never leaves the wallet.
// Agent wallets created since 17 Nov 2026 are owned by a passkey instead; its
// private key never leaves the owner's device (@simplewebauthn/browser).

let connector: NearConnector | null = null;

async function nearConnector(): Promise<NearConnector> {
  const { NearConnector } = await import("@hot-labs/near-connect");
  connector ??= new NearConnector({ network: "mainnet" });
  return connector;
}

export async function wallet() {
  const connector = await nearConnector();
  try {
    return await connector.wallet();
  } catch {
    return await connector.connect();
  }
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(friendlyError(data.error ?? { status: res.status }));
  return data as T;
}

/** One wallet the owner can pick in "Connect your wallet" (after choosing its chain). */
export interface WalletChoice {
  id: string;
  name: string;
  icon: string;
}

/** The NEAR wallets HOT's connector knows (browser extensions, apps and web wallets). */
export async function nearWallets(): Promise<WalletChoice[]> {
  const c = await nearConnector();
  await c.whenManifestLoaded;
  return c.availableWallets.map((w) => ({ id: w.manifest.id, name: w.manifest.name, icon: w.manifest.icon }));
}

/** Connects the NEAR wallet the owner picked and signs the NEP-413 sign-in message; the server checks it and sets the owner session. */
export async function signInWithNear(walletId?: string) {
  const c = await (await fetch("/api/auth/challenge")).json();
  const w = walletId ? await (await nearConnector()).connect({ walletId }) : await wallet();
  const nonce = Uint8Array.from(atob(c.nonce), (ch) => ch.charCodeAt(0));
  const signed = await w.signMessage({ message: c.message, recipient: c.recipient, nonce });
  await post("/api/auth/verify", { token: c.token, accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature });
}

// --- Sui (dApp Kit core: every Sui wallet installed in this browser, plus Slush on the web) ---

let suiKit: Promise<DAppKit> | null = null;

function sui(): Promise<DAppKit> {
  suiKit ??= (async () => {
    const [{ createDAppKit }, { SuiGrpcClient }] = await Promise.all([import("@mysten/dapp-kit-core"), import("@mysten/sui/grpc")]);
    return createDAppKit({
      networks: ["mainnet"],
      // Sign-in is always a fresh choice: never reconnect a wallet by itself.
      autoConnect: false,
      createClient: (network) => new SuiGrpcClient({ network, baseUrl: "https://fullnode.mainnet.sui.io:443" }),
      slushWalletConfig: { appName: "Bursr" },
    }) as unknown as DAppKit;
  })();
  return suiKit;
}

async function suiWalletId(w: UiWallet): Promise<string> {
  const { getWalletUniqueIdentifier } = await import("@mysten/dapp-kit-core");
  return getWalletUniqueIdentifier(w);
}

/** Calls back with the Sui wallets available now and whenever one registers (extensions load a moment after the page). */
export function watchSuiWallets(cb: (wallets: WalletChoice[]) => void): () => void {
  let stop = () => {};
  let stopped = false;
  void sui().then((kit) => {
    if (stopped) return;
    stop = kit.stores.$wallets.subscribe(async (list) => {
      cb(await Promise.all(list.map(async (w) => ({ id: await suiWalletId(w), name: w.name, icon: w.icon }))));
    });
  });
  return () => {
    stopped = true;
    stop();
  };
}

/** Connects the Sui wallet the owner picked and signs Bursr's sign-in message; the server checks it and sets the owner session. */
export async function signInWithSui(walletId: string) {
  const kit = await sui();
  let picked: UiWallet | undefined;
  for (const w of kit.stores.$wallets.get()) if ((await suiWalletId(w)) === walletId) picked = w;
  if (!picked) throw new Error("That Sui wallet isn't available any more. Pick it again.");
  const { accounts } = await kit.connectWallet({ wallet: picked });
  const account = accounts[0];
  if (!account) throw new Error("Your Sui wallet didn't share an account. Open it, unlock it, and try again.");
  const c = await (await fetch("/api/auth/challenge")).json();
  const signed = await kit.signPersonalMessage({ message: new TextEncoder().encode(c.suiMessage), account });
  await post("/api/auth/verify", { chain: "sui", token: c.token, address: account.address, signature: signed.signature });
  // Remember the wallet, so a top-up later asks this same wallet.
  try {
    localStorage.setItem(SUI_WALLET_KEY, walletId);
  } catch {
    /* storage blocked: the owner picks the wallet again */
  }
}

const SUI_WALLET_KEY = "bursr:sui-wallet";
/** Network fee headroom on Sui, in MIST (0.01 SUI). */
const SUI_GAS_MIN = 10_000_000n;

/** The connected Sui account, reconnecting to the wallet the owner signed in with if needed. It must be the owner's own address. */
async function ownerSuiAccount(kit: DAppKit, ownerAddress: string) {
  const { normalizeSuiAddress } = await import("@mysten/sui/utils");
  const want = normalizeSuiAddress(ownerAddress);
  const now = kit.stores.$connection.get();
  if (now.isConnected && normalizeSuiAddress(now.account.address) === want) return now.account;
  let savedId: string | null = null;
  try {
    savedId = localStorage.getItem(SUI_WALLET_KEY);
  } catch {
    savedId = null;
  }
  let wallet: UiWallet | undefined;
  for (const w of kit.stores.$wallets.get()) if ((await suiWalletId(w)) === savedId) wallet = w;
  if (!wallet) throw new Error("Open the Sui wallet you signed in with (for example Slush), unlock it, and try again.");
  const { accounts } = await kit.connectWallet({ wallet });
  const account = accounts.find((a) => normalizeSuiAddress(a.address) === want);
  if (!account) throw new Error(`Switch your Sui wallet to the account you signed in with (${want.slice(0, 6)}…${want.slice(-4)}), then try again.`);
  return account;
}

/**
 * One-tap top-up from the owner's Sui wallet: one USDC transfer on Sui to the
 * agent wallet's one-time deposit address. Checks the wallet holds enough USDC
 * and a little SUI for the network fee before the wallet opens. Amounts are in
 * USDC's smallest units.
 */
export async function sendUsdcFromSui(p: { amount: bigint; decimals: number; coinType: string; to: string; ownerAddress: string; minimumUnits: string | null }): Promise<{ digest: string }> {
  if (p.minimumUnits && p.amount < BigInt(p.minimumUnits)) {
    throw new Error(`The smallest top-up from Sui is $${(Number(p.minimumUnits) / 10 ** p.decimals).toFixed(2)}.`);
  }
  const kit = await sui();
  const account = await ownerSuiAccount(kit, p.ownerAddress);
  const client = kit.getClient();
  const [usdc, gas] = await Promise.all([client.core.getBalance({ owner: account.address, coinType: p.coinType }), client.core.getBalance({ owner: account.address })]);
  const held = BigInt(usdc.balance.balance);
  if (held < p.amount) {
    throw new Error(`Your Sui wallet holds $${(Number(held) / 10 ** p.decimals).toFixed(2)} USDC, less than you asked to add. Add USDC to it, or add less.`);
  }
  if (BigInt(gas.balance.balance) < SUI_GAS_MIN) throw new Error("Your Sui wallet needs a little SUI (about 0.01) for the network fee.");
  const { Transaction } = await import("@mysten/sui/transactions");
  const tx = new Transaction();
  tx.setSender(account.address);
  tx.transferObjects([tx.coin({ balance: p.amount, type: p.coinType })], p.to);
  const r = await kit.signAndExecuteTransaction({ transaction: tx, account });
  if (r.$kind === "FailedTransaction") throw new Error("The transfer didn't go through on Sui, so nothing was sent. Please try again.");
  return { digest: r.Transaction.digest };
}

/** Signs out of Bursr and disconnects the wallet, so the next "Connect" can pick any wallet. */
export async function signOut() {
  await post("/api/auth/signout", {});
  try {
    await connector?.disconnect();
  } catch {
    /* already disconnected */
  }
  try {
    if (suiKit) await (await suiKit).disconnectWallet();
  } catch {
    /* already disconnected */
  }
}

/** Creates the passkey that will own the agent's wallet (the device's Face ID, fingerprint or PIN prompt). Returns whether it syncs to a password manager. */
export async function createPasskey(): Promise<{ backedUp: boolean }> {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const options = await post<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/owner/passkey", { step: "options" });
  const response = await startRegistration({ optionsJSON: options });
  return post<{ backedUp: boolean }>("/api/owner/passkey", { step: "verify", response });
}

export type OwnerIntentKind = "agent_create" | "policy_update" | "agent_freeze" | "agent_unfreeze" | "grant_issue";

export interface PreparedIntent {
  kind: OwnerIntentKind;
  correlationId: string;
  agentId: string;
  expiresAt: string;
  summary: string;
  policy?: unknown;
  intent: { standard: string; payload: Record<string, unknown> };
}

/** Asks Bursr's server to prepare a change for the owner's wallet to sign (nothing is signed yet). */
export function prepareIntent(kind: OwnerIntentKind): Promise<PreparedIntent> {
  return post<PreparedIntent>("/api/owner/intent", { step: "prepare", kind });
}

/** The owner's wallet signs the prepared change and Bursr submits it. Throws a plain-words error if it isn't applied. */
export async function signAndSubmitIntent(prepared: PreparedIntent): Promise<void> {
  const { intent } = prepared;
  let signedData: Record<string, unknown>;
  if (intent.standard === "webauthn") {
    // Passkey owner: the device signs the Agent API's own prompt, passed through unchanged (SDK README).
    const { startAuthentication } = await import("@simplewebauthn/browser");
    signedData = { ...intent, credential: await startAuthentication({ optionsJSON: intent.payload as never }) };
  } else if (intent.standard === "nep366") {
    const w = await wallet();
    const out = await w.signDelegateActions({ delegateActions: [intent.payload as never] });
    signedData = { ...intent, signed_delegate: out.signedDelegateActions[0] };
  } else if (intent.standard === "nep413") {
    const w = await wallet();
    const p = intent.payload as { message: string; recipient: string; nonce: string };
    const nonce = Uint8Array.from(atob(p.nonce), (ch) => ch.charCodeAt(0));
    const out = await w.signMessage({ message: p.message, recipient: p.recipient, nonce });
    signedData = { ...intent, public_key: out.publicKey, signature: out.signature };
  } else {
    throw new Error("This wallet can't sign this kind of confirmation. Try HOT Wallet.");
  }
  const result = await post<{ status: string; failureCode: string | null }>("/api/owner/intent", {
    step: "submit",
    kind: prepared.kind,
    correlationId: prepared.correlationId,
    agentId: prepared.agentId,
    signedData,
  });
  if (result.status !== "SUCCESS") {
    throw new Error(
      friendlyError(
        { code: result.failureCode ?? "" },
        result.status === "REFUSED" ? "Your wallet's confirmation wasn't accepted, so nothing changed. Please try again." : "That didn't go through, so nothing changed. Please try again in a minute.",
      ),
    );
  }
}
