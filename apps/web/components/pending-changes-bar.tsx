"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { prepareIntent, signAndSubmitIntent, type PreparedIntent } from "./wallet";

// Live mode, on every page: changes the owner made that their wallet hasn't
// locked into the agent's wallet yet. Confirm from wherever you are: the
// first tap prepares the change, the second opens the wallet (browsers only
// let a wallet open from a tap).

export function PendingChangesBar({ lines, onlyTighter }: { lines: string[]; onlyTighter: boolean }) {
  const router = useRouter();
  const [prepared, setPrepared] = useState<PreparedIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function act(fn: () => Promise<void>) {
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

  if (done) {
    return (
      <p role="status" className="border-b border-ledger/30 bg-ledger-soft px-4 py-3 text-sm sm:px-8">
        Done. Your agent&apos;s wallet now follows your changes.
      </p>
    );
  }

  return (
    <section aria-label="Changes to confirm" className="border-b border-hold/30 bg-hold-soft/70 px-4 py-3 sm:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={16} weight="bold" aria-hidden className="text-hold" />
            {lines.length === 1 ? "1 change to confirm with your wallet" : `${lines.length} changes to confirm with your wallet`}: {lines.join(" · ")}
          </p>
          <p className="text-muted">
            {onlyTighter
              ? "Bursar already follows this. Confirming locks it into your agent's wallet too."
              : "New people and higher limits take effect once you confirm. Until then your agent won't use them."}
          </p>
          {error && (
            <p role="alert" className="mt-1 text-refuse">
              {error}
            </p>
          )}
        </div>
        {prepared ? (
          <button
            onClick={() =>
              act(async () => {
                await signAndSubmitIntent(prepared);
                setPrepared(null);
                setDone(true);
                router.refresh();
              })
            }
            disabled={busy}
            className="rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60"
          >
            {busy ? "Check your wallet app…" : "Open my wallet to confirm"}
          </button>
        ) : (
          <button
            onClick={() => act(async () => setPrepared(await prepareIntent("policy_update")))}
            disabled={busy}
            className="rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60"
          >
            {busy ? "Preparing…" : "Confirm with my wallet"}
          </button>
        )}
      </div>
    </section>
  );
}
