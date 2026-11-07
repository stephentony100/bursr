"use client";

import { useActionState } from "react";
import type { AttestationResult } from "@/lib/attestation";

/** "Verified" panel: proof that the invoice reader runs inside a TEE, checked live with a fresh nonce. */
export function VerifiedPanel({ action, model }: { action: () => Promise<AttestationResult>; model: string }) {
  const [result, run, pending] = useActionState(action, null);
  return (
    <section className="rounded-xl border border-line bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-xl font-semibold">
            Private reading{" "}
            {result && (
              <span className={`ml-2 rounded-full px-3 py-1 align-middle text-sm ${result.verified ? "bg-ledger-soft text-ledger" : "bg-refuse-soft text-refuse"}`}>
                {result.verified ? "Verified" : "Not verified"}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Invoices are read by <span className="num">{model}</span> on NEAR AI Cloud, inside a secure enclave (Intel TDX with an NVIDIA
            confidential GPU). Bursar can check that proof itself: it sends a fresh random number and verifies the signed hardware report that
            comes back, following NEAR AI&apos;s verification steps.
          </p>
        </div>
        <form action={run}>
          <button disabled={pending} className="rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Checking… (about 20 s)" : result ? "Check again" : "Check it now"}
          </button>
        </form>
      </div>
      {result && (
        <div className="mt-4 space-y-4 text-sm">
          {result.error && <p className="text-refuse">{result.error}</p>}
          <p className="num text-xs text-muted">
            Fresh nonce {result.nonce} · {new Date(result.at).toLocaleString("en-GB")}
          </p>
          {result.enclaves.map((e) => (
            <div key={e.name + e.signingAddress}>
              <p className="font-medium">
                {e.name} {e.signingAddress && <span className="num text-xs font-normal text-muted">signer {e.signingAddress}</span>}
              </p>
              <ul className="mt-1 space-y-1">
                {e.checks.map((c) => (
                  <li key={c.label} className="flex gap-2">
                    <span className={c.ok ? "text-ledger" : "text-refuse"} aria-label={c.ok ? "passed" : "failed"}>
                      {c.ok ? "✓" : "✗"}
                    </span>
                    <span>
                      {c.label} <span className="num text-xs text-muted">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
