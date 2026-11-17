"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPasskey, prepareIntent, signAndSubmitIntent, signInWithWallet, signOut as walletSignOut, type OwnerIntentKind, type PreparedIntent } from "./wallet";
import { friendlyError } from "@/lib/errors";

// Live mode only. The owner signs everything: with the passkey that owns the
// agent's wallet (new businesses), or with their NEAR wallet (agent wallets
// created before passkeys). Bursr's server never sees the owner's key. Before
// any signature the owner sees exactly what the Agent API prepared.

type Kind = OwnerIntentKind;
type Prepared = PreparedIntent;

const LABELS: Record<Kind, string> = {
  agent_create: "Set up my Bursr wallet with these limits",
  policy_update: "Confirm my changes",
  agent_freeze: "Pause all payments",
  agent_unfreeze: "Turn payments back on",
  grant_issue: "Let Bursr make payments inside my limits",
};

export function WalletPanel(props: {
  ownerAccountId: string | null;
  businessExists: boolean;
  businessOwner: string | null;
  agentId: string | null;
  needsSigning: boolean;
  hasGrant: boolean;
  /** ISO date the payment pass ends, when it ends within 3 days. */
  grantRenewBy: string | null;
  frozen: boolean;
  /** The passkey that owns (or will own) the agent's wallet; null for agent wallets owned by a NEAR wallet. */
  passkey: { backedUp: boolean } | null;
  /** Inside /welcome: no heading, sign-out or pause; the two confirmations are counted. */
  onboarding?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);

  async function guard(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
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

  const prepare = (kind: Kind) =>
    guard(async () => {
      setNotice(null);
      setPrepared(await prepareIntent(kind));
    });

  const makePasskey = () =>
    guard(async () => {
      setNotice(null);
      const { backedUp } = await createPasskey();
      setNotice(backedUp ? "Passkey saved. It syncs to your password manager." : "Passkey saved on this device only.");
      router.refresh();
    });

  const signAndSubmit = () =>
    guard(async () => {
      if (!prepared) return;
      await signAndSubmitIntent(prepared);
      setPrepared(null);
      setNotice(prepared.kind === "grant_issue" ? "Done. Bursr can now make payments inside your limits." : "Done. Your wallet now enforces this.");
      router.refresh();
    });

  // Passkey owners confirm with the device's Face ID, fingerprint or PIN; older agent wallets with the NEAR wallet app.
  const withPasskey = Boolean(props.passkey) || !props.agentId;
  const needsPasskey = !props.agentId && !props.passkey;
  const next: Kind | null = !props.agentId
    ? "agent_create"
    : props.needsSigning
      ? "policy_update"
      : !props.hasGrant || props.grantRenewBy
        ? "grant_issue"
        : null;

  return (
    <section className={props.onboarding ? "" : "rounded-2xl border-2 border-indigo/30 bg-card p-6"}>
      {!props.onboarding && <h2 className="text-xl font-bold">Your Bursr wallet</h2>}

      {!props.ownerAccountId ? (
        <div className="mt-3">
          <p className="text-sm text-muted">Sign in with your wallet app (for example HOT Wallet) to set up or manage your business. Signing in is free.</p>
          <button onClick={signIn} disabled={busy} className="mt-3 rounded-xl bg-ledger px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60">
            {busy ? "Check your wallet app…" : "Sign in"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          {!props.onboarding && (
            <p>
              Signed in as <span className="num font-medium">{props.ownerAccountId}</span>{" "}
              <button onClick={signOut} className="text-indigo underline">
                Sign out
              </button>
            </p>
          )}

          {!props.businessExists && (
            <p>
              <a href="/welcome" className="font-medium text-indigo underline">
                Set up your business
              </a>{" "}
              <span className="text-muted">(a few short steps: your business, your limits, who you pay, then your wallet turns the agent on).</span>
            </p>
          )}

          {props.onboarding && next && (
            <p className="font-medium">
              Step {needsPasskey ? 1 : next === "grant_issue" ? 3 : 2} of 3:{" "}
              {needsPasskey ? "create your passkey." : next === "grant_issue" ? "let your agent pay inside your limits." : "create your agent's wallet with your limits and the people you pay."}
            </p>
          )}

          {props.businessExists && (
            <>
              <p className="text-muted">
                {props.agentId
                  ? props.hasGrant
                    ? "Your wallet is set up and Bursr can pay inside your limits."
                    : "Your wallet is set up. One more step lets Bursr make payments."
                  : needsPasskey
                    ? "Your passkey is the key to your agent's wallet. Save it to iCloud Keychain or Google Password Manager so you never lose it. If it's lost, nobody, not even Bursr, can change your limits."
                    : "Next: set up your Bursr wallet. It's free; your passkey just confirms it."}
              </p>
              {props.passkey && (
                <p className={props.passkey.backedUp ? "text-muted" : "text-hold"}>
                  {props.passkey.backedUp
                    ? "Your agent's wallet is controlled by your passkey, synced to your password manager."
                    : "Your passkey is saved on this device only. If you lose this device, nobody can change your limits. Keep it safe."}
                </p>
              )}
              {props.grantRenewBy && (
                <p className="text-hold">
                  Bursr&apos;s permission to pay ends on {new Date(props.grantRenewBy).toLocaleDateString([], { day: "numeric", month: "short" })}. Renew it so payday isn&apos;t missed.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {needsPasskey && (
                  <button onClick={makePasskey} disabled={busy} className="rounded-xl bg-ledger px-4 py-2.5 font-semibold text-white hover:bg-indigo disabled:opacity-60">
                    {busy ? "Check the passkey prompt…" : "Create your passkey"}
                  </button>
                )}
                {next && !needsPasskey && (
                  <button onClick={() => prepare(next)} disabled={busy} className="rounded-xl bg-ledger px-4 py-2.5 font-semibold text-white hover:bg-indigo disabled:opacity-60">
                    {next === "grant_issue" && props.hasGrant ? "Renew Bursr's permission to pay" : LABELS[next]}…
                  </button>
                )}
                {props.agentId && !props.onboarding && (
                  <button
                    onClick={() => prepare(props.frozen ? "agent_unfreeze" : "agent_freeze")}
                    disabled={busy}
                    className={`rounded-xl px-4 py-2 font-medium disabled:opacity-60 ${props.frozen ? "bg-ledger text-card" : "bg-refuse text-card"}`}
                  >
                    {props.frozen ? "Turn payments back on…" : "Pause all payments…"}
                  </button>
                )}
              </div>
            </>
          )}

          {prepared && (
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="font-medium">{LABELS[prepared.kind]}</p>
              <details className="mt-1">
                <summary className="cursor-pointer text-muted">Technical details of what you&apos;re confirming</summary>
                <p className="mt-1 text-muted">{prepared.summary}</p>
                {prepared.policy !== undefined && (
                  <pre className="num mt-2 max-h-72 overflow-auto rounded bg-card p-3 text-xs">{JSON.stringify(prepared.policy, null, 2)}</pre>
                )}
              </details>
              <p className="mt-2 text-muted">
                {withPasskey ? "Your device will ask for your Face ID, fingerprint or PIN." : "Your wallet app will ask you to confirm."} It costs you nothing. Please confirm before{" "}
                {new Date(prepared.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={signAndSubmit} disabled={busy} className="rounded-xl bg-ledger px-4 py-2.5 font-semibold text-white hover:bg-indigo disabled:opacity-60">
                  {busy ? (withPasskey ? "Check the passkey prompt…" : "Check your wallet app…") : withPasskey ? "Confirm with my passkey" : "Confirm in my wallet"}
                </button>
                <button onClick={() => setPrepared(null)} disabled={busy} className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:bg-paper">
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {notice && <p role="status" className="mt-3 text-sm text-ok">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-refuse">{error}</p>}
    </section>
  );
}
