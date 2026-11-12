"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithWallet, signOut } from "./wallet";
import { friendlyError } from "@/lib/errors";

/** Live mode: sign in or out from any page. */
export function HeaderWallet({ accountId, tone = "light" }: { accountId: string | null; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
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
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (accountId) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ledger-soft font-bold uppercase text-ledger">
          {accountId.slice(0, 1)}
        </span>
        <span className={`hidden max-w-40 truncate font-medium sm:inline ${dark ? "text-ink" : "text-cream/80"}`} title="You're signed in as the owner">
          {accountId}
        </span>
        <button onClick={() => run(signOut)} disabled={busy} className={`shrink-0 font-semibold disabled:opacity-60 ${dark ? "text-muted hover:text-ink" : "text-card/80 hover:text-card"}`}>
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
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${dark ? "bg-ledger text-white hover:bg-indigo" : "bg-card text-ink hover:bg-paper"}`}
      >
        {busy ? "Check your wallet…" : "Sign in"}
      </button>
      {error && (
        <span role="alert" className={`max-w-56 text-xs ${dark ? "text-refuse" : "text-refuse-bright"}`}>
          {error}
        </span>
      )}
    </span>
  );
}
