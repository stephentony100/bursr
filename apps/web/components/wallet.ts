"use client";

import type { NearConnector } from "@hot-labs/near-connect";

// One wallet connection for the whole app (HOT and other NEAR wallets via
// @hot-labs/near-connect). The owner's key never leaves the wallet.

let connector: NearConnector | null = null;

export async function wallet() {
  const { NearConnector } = await import("@hot-labs/near-connect");
  connector ??= new NearConnector({ network: "mainnet" });
  try {
    return await connector.wallet();
  } catch {
    return await connector.connect();
  }
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/** Signs a NEP-413 sign-in message with the wallet; the server checks it and sets the owner session. */
export async function signInWithWallet() {
  const c = await (await fetch("/api/auth/challenge")).json();
  const w = await wallet();
  const nonce = Uint8Array.from(atob(c.nonce), (ch) => ch.charCodeAt(0));
  const signed = await w.signMessage({ message: c.message, recipient: c.recipient, nonce });
  await post("/api/auth/verify", { token: c.token, accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature });
}

export async function signOut() {
  await post("/api/auth/signout", {});
}
