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
      <span className="flex items-center gap-2 text-sm">
        <span className={`num ${dark ? "text-muted" : "text-cream/70"}`} title="You're signed in as the owner">
          {accountId}
        </span>
        <button onClick={() => run(signOut)} disabled={busy} className={`underline disabled:opacity-60 ${dark ? "text-indigo" : "text-card decoration-card/40 hover:decoration-card"}`}>
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
        className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${dark ? "bg-ledger text-white hover:bg-indigo" : "bg-card text-ink hover:bg-paper"}`}
      >
        {busy ? "Check your wallet…" : "Sign in"}
      </button>
      {error && (
        <span role="alert" className={`max-w-56 text-xs ${dark ? "text-refuse" : "text-[#ffc9c3]"}`}>
          {error}
        </span>
      )}
    </span>
  );
}
