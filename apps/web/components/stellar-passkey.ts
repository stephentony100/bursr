"use client";

import type { SmartAccountKit } from "smart-account-kit";
import { friendlyError } from "@/lib/errors";

// Stellar edition, in the browser: sign up and sign in with a passkey, no
// wallet. The Smart Account Kit (Apache-2.0) creates the passkey and its
// passkey account, and signs the owner's approvals with the passkey. Bursr's
// server checks and sends everything (app/api/auth/passkey/*,
// lib/stellar-passkey.ts) and pays the network fees; the kit reads the chain
// through Bursr's read-only RPC (app/api/stellar/rpc).

interface KitSettings {
  networkPassphrase: string;
  accountWasmHash: string;
  webauthnVerifier: string;
  rpId: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

let kitPromise: Promise<SmartAccountKit> | null = null;
/** One kit per page. `registrationChallenge`: Bursr's own challenge for a new passkey, so the server can check it is fresh. */
async function kit(settings: KitSettings, registrationChallenge?: string): Promise<SmartAccountKit> {
  if (registrationChallenge) kitPromise = null;
  kitPromise ??= (async () => {
    const [{ SmartAccountKit, IndexedDBStorage }, webauthn] = await Promise.all([import("smart-account-kit"), import("@simplewebauthn/browser")]);
    return new SmartAccountKit({
      rpcUrl: `${window.location.origin}/api/stellar/rpc`,
      networkPassphrase: settings.networkPassphrase,
      accountWasmHash: settings.accountWasmHash,
      webauthnVerifierAddress: settings.webauthnVerifier,
      rpId: settings.rpId,
      rpName: "Bursr",
      horizonUrl: false,
      indexerUrl: false,
      storage: new IndexedDBStorage(),
      // The kit ships @simplewebauthn/browser 13 and Bursr 14: same JSON, slightly different types, hence the casts.
      webAuthn: {
        startRegistration: (o) =>
          webauthn.startRegistration({ ...o, optionsJSON: registrationChallenge ? { ...o.optionsJSON, challenge: registrationChallenge } : o.optionsJSON } as never) as never,
        startAuthentication: (o) => webauthn.startAuthentication(o as never) as never,
      },
    });
  })();
  return kitPromise;
}

/** New owner: creates a passkey and its passkey account, then Bursr sends the account's deploy and signs the owner in. */
export async function signUpWithPasskey(businessName: string): Promise<{ accountId: string }> {
  const { options, kit: settings } = await getJson<{ options: { challenge: string }; kit: KitSettings }>(
    `/api/auth/passkey/options?for=signup&name=${encodeURIComponent(businessName)}`,
  );
  const k = await kit(settings, options.challenge);
  const made = await k.createWallet("Bursr", businessName || "My business", { autoSubmit: false, authenticatorSelection: { residentKey: "required" } });
  if (!made.relayerPayload) throw new Error("Your passkey account couldn't be prepared. Please try again.");
  const r = await postJson<{ accountId: string }>("/api/auth/passkey/signup", { response: made.rawResponse, contractId: made.contractId, relayerPayload: made.relayerPayload });
  await k.connectWallet({ credentialId: made.credentialId, contractId: made.contractId }).catch(() => null);
  return r;
}

/** Returning owner: their passkey answers Bursr's challenge. */
export async function signInWithPasskey(): Promise<{ accountId: string }> {
  const { options } = await getJson<{ options: Parameters<typeof import("@simplewebauthn/browser").startAuthentication>[0]["optionsJSON"] }>("/api/auth/passkey/options?for=signin");
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const response = await startAuthentication({ optionsJSON: options });
  return postJson("/api/auth/passkey/signin", { response });
}

/** The approvals a passkey owner signs for an owner action (lib/stellar-owner.ts, standard "stellar-auth"). */
export interface PasskeyApproval {
  entries: string[];
  networkPassphrase: string;
  /** The owner's passkey account (C…). */
  address: string;
  /** Last ledger the approval may be used in. */
  expiration: number;
  credentialId?: string;
}

/** Signs each approval with the owner's passkey (one prompt each). Returns them as base64. */
export async function signApprovals(p: PasskeyApproval): Promise<string[]> {
  const { kit: settings } = await getJson<{ kit: KitSettings }>("/api/auth/passkey/options?for=signin");
  const k = await kit(settings);
  try {
    if (k.contractId !== p.address) await k.connectWallet({ contractId: p.address, credentialId: p.credentialId, prompt: true });
    const signed: string[] = [];
    for (const entry of p.entries) signed.push(await k.signAuthEntry(entry, { expiration: p.expiration, contextRuleIds: [0], credentialId: p.credentialId }));
    return signed;
  } catch (e) {
    throw new Error(friendlyError(e, "Your passkey didn't approve this. Nothing changed."));
  }
}
