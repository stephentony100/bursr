"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithWallet, signOut } from "./wallet";

/** Live mode: sign in or out from any page. */
export function HeaderWallet({ accountId }: { accountId: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (accountId) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="num text-muted" title="Signed in as the owner">
          {accountId}
        </span>
        <button onClick={() => run(signOut)} disabled={busy} className="text-indigo underline disabled:opacity-60">
          Sign out
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <button
        onClick={() => run(signInWithWallet)}
        disabled={busy}
        className="rounded-md bg-indigo px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Waiting for your wallet…" : "Sign in with NEAR wallet"}
      </button>
      {error && (
        <span role="alert" className="max-w-56 text-xs text-refuse">
          {error}
        </span>
      )}
    </span>
  );
}
