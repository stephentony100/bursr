"use client";

import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import type { AttestationResult } from "@/lib/attestation";

// "Your invoices stay private": a live check that the AI reading invoices runs
// inside a sealed, verifiable computer (NEAR AI Cloud TEE). Plain promises up
// front; the full technical list for an accountant or auditor underneath.

const PROMISES: { text: string; matches: (label: string) => boolean }[] = [
  { text: "The computer reading your invoices is a genuine, sealed one, and up to date", matches: (l) => /quote is genuine|debug mode|Quote is a TDX/.test(l) },
  { text: "Its secure graphics chip is genuine too (checked with NVIDIA)", matches: (l) => /GPU/.test(l) },
  { text: "The proof was made just now, for this check, not copied from before", matches: (l) => /nonce/i.test(l) },
  { text: "It runs exactly the published software, nothing added", matches: (l) => /configuration|event log/i.test(l) },
];

export function VerifiedPanel({ action, model }: { action: () => Promise<AttestationResult>; model: string }) {
  const [result, run, pending] = useActionState(action, null);
  const checks = result?.enclaves.flatMap((e) => e.checks) ?? [];
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-bold">
            Your invoices stay private{" "}
            {result && (
              <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${result.verified ? "bg-ok-soft text-ok" : "bg-refuse-soft text-refuse"}`}>
                {result.verified ? <CheckCircle size={13} weight="fill" aria-hidden /> : <XCircle size={13} weight="fill" aria-hidden />}
                {result.verified ? "Proof checked" : "Proof not confirmed"}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-muted">Read by AI in a sealed computer. Check its signed proof, live.</p>
        </div>
        <form action={run}>
          <button disabled={pending} className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold hover:bg-paper disabled:opacity-60">
            {pending ? "Checking, about 20 seconds" : result ? "Check again" : "Check the proof"}
          </button>
        </form>
      </div>
      {result && (
        <div className="mt-4 space-y-3 text-sm">
          {result.error && <p className="text-refuse">Bursr couldn&apos;t reach the proof just now. Please try again in a minute.</p>}
          {checks.length > 0 && (
            <ul className="space-y-1">
              {PROMISES.map((p) => {
                const relevant = checks.filter((c) => p.matches(c.label));
                const ok = relevant.length > 0 && relevant.every((c) => c.ok);
                return (
                  <li key={p.text} className="flex gap-2">
                    <span className={`mt-0.5 shrink-0 ${ok ? "text-ok" : "text-refuse"}`} aria-label={ok ? "confirmed" : "not confirmed"}>
                      {ok ? <CheckCircle size={16} weight="fill" /> : <XCircle size={16} weight="fill" />}
                    </span>
                    <span>{p.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-muted">Technical details for your accountant or auditor</summary>
            <div className="mt-2 space-y-3">
              <p className="num text-xs text-muted">
                Model {model} on NEAR AI Cloud · fresh nonce {result.nonce} · {new Date(result.at).toLocaleString("en-GB")}
                {result.error ? ` · ${result.error}` : ""}
              </p>
              {result.enclaves.map((e) => (
                <div key={e.name + e.signingAddress}>
                  <p className="font-medium">
                    {e.name} {e.signingAddress && <span className="num text-xs font-normal text-muted">signer {e.signingAddress}</span>}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {e.checks.map((c) => (
                      <li key={c.label} className="flex gap-2">
                        <span className={`mt-0.5 shrink-0 ${c.ok ? "text-ok" : "text-refuse"}`} aria-label={c.ok ? "passed" : "failed"}>
                          {c.ok ? <CheckCircle size={15} weight="fill" /> : <XCircle size={15} weight="fill" />}
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
          </details>
        </div>
      )}
    </section>
  );
}
