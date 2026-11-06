"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NearConnector } from "@hot-labs/near-connect";

// Live mode only. The owner's wallet (HOT, via @hot-labs/near-connect) signs
// everything; Bursar's server never sees the owner's key. Before any signature
// the owner sees exactly what the Agent API prepared.

type Kind = "agent_create" | "policy_update" | "agent_freeze" | "agent_unfreeze" | "grant_issue";

interface Prepared {
  kind: Kind;
  correlationId: string;
  agentId: string;
  expiresAt: string;
  summary: string;
  policy?: unknown;
  intent: { standard: string; payload: Record<string, unknown> };
}

let connector: NearConnector | null = null;
async function wallet() {
  const { NearConnector } = await import("@hot-labs/near-connect");
  connector ??= new NearConnector({ network: "mainnet" });
  try {
    return await connector.wallet();
  } catch {
    return await connector.connect();
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

const LABELS: Record<Kind, string> = {
  agent_create: "Create the agent account with these rules",
  policy_update: "Sign your updated rules",
  agent_freeze: "Freeze all payments",
  agent_unfreeze: "Unfreeze payments",
  grant_issue: "Let Bursar pay inside these rules",
};

export function WalletPanel(props: {
  ownerAccountId: string | null;
  businessExists: boolean;
  businessOwner: string | null;
  agentId: string | null;
  needsSigning: boolean;
  hasGrant: boolean;
  frozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [grantToken, setGrantToken] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const signIn = () =>
    guard(async () => {
      const c = await (await fetch("/api/auth/challenge")).json();
      const w = await wallet();
      const nonce = Uint8Array.from(atob(c.nonce), (ch) => ch.charCodeAt(0));
      const signed = await w.signMessage({ message: c.message, recipient: c.recipient, nonce });
      await post("/api/auth/verify", { token: c.token, accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature });
      router.refresh();
    });

  const signOut = () =>
    guard(async () => {
      await post("/api/auth/signout", {});
      router.refresh();
    });

  const setup = () =>
    guard(async () => {
      await post("/api/owner/setup", { name });
      router.refresh();
    });

  const prepare = (kind: Kind) =>
    guard(async () => {
      setNotice(null);
      setPrepared(await post<Prepared>("/api/owner/intent", { step: "prepare", kind }));
    });

  const signAndSubmit = () =>
    guard(async () => {
      if (!prepared) return;
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
        throw new Error(`This wallet cannot sign ${intent.standard}.`);
      }
      const result = await post<{ status: string; failureCode: string | null; grantToken?: string }>("/api/owner/intent", {
        step: "submit",
        kind: prepared.kind,
        correlationId: prepared.correlationId,
        agentId: prepared.agentId,
        signedData,
      });
      setPrepared(null);
      if (result.status !== "SUCCESS") throw new Error(`Not applied: ${result.failureCode ?? result.status}`);
      if (result.grantToken) setGrantToken(result.grantToken);
      setNotice("Done. The account now enforces this.");
      router.refresh();
    });

  const next: Kind | null = !props.agentId
    ? "agent_create"
    : props.needsSigning
      ? "policy_update"
      : !props.hasGrant
        ? "grant_issue"
        : null;

  return (
    <section className="rounded-xl border-2 border-indigo/30 bg-card p-6">
      <h2 className="font-display text-xl font-semibold">Your wallet and the agent account</h2>

      {!props.ownerAccountId ? (
        <div className="mt-3">
          <p className="text-sm text-muted">Sign in with the NEAR wallet that owns this business (for example HOT Wallet). Signing in costs nothing.</p>
          <button onClick={signIn} disabled={busy} className="mt-3 rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Waiting for your wallet…" : "Sign in with NEAR wallet"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <p>
            Signed in as <span className="num font-medium">{props.ownerAccountId}</span>{" "}
            <button onClick={signOut} className="text-indigo underline">
              Sign out
            </button>
          </p>

          {!props.businessExists && (
            <div>
              <label className="block font-medium">
                Business name
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full max-w-sm rounded-md border border-line px-3 py-2" />
              </label>
              <p className="mt-1 text-muted">Starts with tiny limits ($20 a week, $10 a payment). You can change them before signing.</p>
              <button onClick={setup} disabled={busy || name.trim().length < 2} className="mt-3 rounded-md bg-ledger px-4 py-2 font-medium text-white disabled:opacity-60">
                Set up my business
              </button>
            </div>
          )}

          {props.businessExists && (
            <>
              <p className="text-muted">
                Agent account: {props.agentId ? <span className="num text-ink">{props.agentId}</span> : "not created yet"}
                {props.agentId && (props.hasGrant ? " · Bursar may pay inside your rules" : " · Bursar cannot pay yet")}
              </p>
              <div className="flex flex-wrap gap-2">
                {next && (
                  <button onClick={() => prepare(next)} disabled={busy} className="rounded-md bg-ledger px-4 py-2 font-medium text-white disabled:opacity-60">
                    {LABELS[next]}…
                  </button>
                )}
                {props.agentId && (
                  <button
                    onClick={() => prepare(props.frozen ? "agent_unfreeze" : "agent_freeze")}
                    disabled={busy}
                    className={`rounded-md px-4 py-2 font-medium disabled:opacity-60 ${props.frozen ? "bg-ledger text-white" : "bg-refuse text-white"}`}
                  >
                    {props.frozen ? "Unfreeze payments…" : "Freeze all payments…"}
                  </button>
                )}
              </div>
            </>
          )}

          {prepared && (
            <div className="rounded-md border border-line bg-paper p-4">
              <p className="font-medium">You are about to sign: {LABELS[prepared.kind]}</p>
              <p className="mt-1 text-muted">{prepared.summary}</p>
              {prepared.policy !== undefined && (
                <pre className="num mt-3 max-h-72 overflow-auto rounded bg-card p-3 text-xs">{JSON.stringify(prepared.policy, null, 2)}</pre>
              )}
              <p className="mt-2 text-muted">
                Your wallet will ask you to sign. {prepared.intent.standard === "nep366" ? "The Agent API sends it to NEAR and pays the gas." : "It is a signed message; nothing is sent on-chain."}{" "}
                Valid until {new Date(prepared.expiresAt).toLocaleTimeString()}.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={signAndSubmit} disabled={busy} className="rounded-md bg-indigo px-4 py-2 font-medium text-white disabled:opacity-60">
                  {busy ? "Waiting for your wallet…" : "Sign with my wallet"}
                </button>
                <button onClick={() => setPrepared(null)} disabled={busy} className="rounded-md border border-line px-4 py-2">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {grantToken && (
            <div className="rounded-md border border-hold bg-hold-soft p-4">
              <p className="font-medium">Add this line to the .env file, then restart Bursar. It is shown only once.</p>
              <pre className="num mt-2 overflow-auto text-xs">AGENT_API_GRANT_TOKEN={grantToken}</pre>
            </div>
          )}
        </div>
      )}

      {notice && <p role="status" className="mt-3 text-sm text-ledger">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-refuse">{error}</p>}
    </section>
  );
}
