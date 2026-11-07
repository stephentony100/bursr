"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post, signInWithWallet, signOut as walletSignOut, wallet } from "./wallet";

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

const LABELS: Record<Kind, string> = {
  agent_create: "Set up my Bursar wallet with these limits",
  policy_update: "Confirm my changes",
  agent_freeze: "Pause all payments",
  agent_unfreeze: "Turn payments back on",
  grant_issue: "Let Bursar make payments inside my limits",
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
      await signInWithWallet();
      router.refresh();
    });

  const signOut = () =>
    guard(async () => {
      await walletSignOut();
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
      setNotice("Done. Your wallet now enforces this.");
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
      <h2 className="font-display text-xl font-semibold">Your Bursar wallet</h2>

      {!props.ownerAccountId ? (
        <div className="mt-3">
          <p className="text-sm text-muted">Sign in with your wallet app (for example HOT Wallet) to set up or manage your business. Signing in is free.</p>
          <button onClick={signIn} disabled={busy} className="mt-3 rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Check your wallet app…" : "Sign in"}
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
              <p className="mt-1 text-muted">You start with small limits ($20 a week, $10 a payment) and can raise them any time.</p>
              <button onClick={setup} disabled={busy || name.trim().length < 2} className="mt-3 rounded-md bg-ledger px-4 py-2 font-medium text-white disabled:opacity-60">
                Set up my business
              </button>
            </div>
          )}

          {props.businessExists && (
            <>
              <p className="text-muted">
                {props.agentId ? (props.hasGrant ? "✓ Your wallet is set up and Bursar can pay inside your limits." : "Your wallet is set up. One more step lets Bursar make payments.") : "Next: set up your Bursar wallet. It's free; your wallet app just confirms it."}
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
                    {props.frozen ? "Turn payments back on…" : "Pause all payments…"}
                  </button>
                )}
              </div>
            </>
          )}

          {prepared && (
            <div className="rounded-md border border-line bg-paper p-4">
              <p className="font-medium">{LABELS[prepared.kind]}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-muted">Technical details of what you&apos;re confirming</summary>
                <p className="mt-1 text-muted">{prepared.summary}</p>
                {prepared.policy !== undefined && (
                  <pre className="num mt-2 max-h-72 overflow-auto rounded bg-card p-3 text-xs">{JSON.stringify(prepared.policy, null, 2)}</pre>
                )}
              </details>
              <p className="mt-2 text-muted">
                Your wallet app will ask you to confirm. It costs you nothing. Please confirm before{" "}
                {new Date(prepared.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={signAndSubmit} disabled={busy} className="rounded-md bg-indigo px-4 py-2 font-medium text-white disabled:opacity-60">
                  {busy ? "Check your wallet app…" : "Confirm in my wallet"}
                </button>
                <button onClick={() => setPrepared(null)} disabled={busy} className="rounded-md border border-line px-4 py-2">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {grantToken && (
            <div className="rounded-md border border-hold bg-hold-soft p-4">
              <p className="font-medium">Last step for whoever set up Bursar for you: add this line to the settings file (.env) and restart Bursar. It is shown only once, so copy it now.</p>
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
