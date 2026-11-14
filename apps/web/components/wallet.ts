"use client";

import type { NearConnector } from "@hot-labs/near-connect";
import { friendlyError } from "@/lib/errors";

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
  if (!res.ok) throw new Error(friendlyError(data.error ?? { status: res.status }));
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

/** Signs out of Bursr and disconnects the wallet, so the next "Connect" can pick any wallet. */
export async function signOut() {
  await post("/api/auth/signout", {});
  try {
    await connector?.disconnect();
  } catch {
    /* already disconnected */
  }
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
  const w = await wallet();
  const { intent } = prepared;
  let signedData: Record<string, unknown>;
  if (intent.standard === "nep366") {
    const out = await w.signDelegateActions({ delegateActions: [intent.payload as never] });
    signedData = { ...intent, signed_delegate: out.signedDelegateActions[0] };
  } else if (intent.standard === "nep413") {
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
