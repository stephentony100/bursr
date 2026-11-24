"use client";

import { Fingerprint } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { signInWithPasskey, signUpWithPasskey } from "./stellar-passkey";

// Stellar edition: the way in for everyone, with no wallet. New owners create
// a passkey (Face ID, fingerprint or the device PIN); returning owners use it.
// `onWallet` shows the wallet list for people who'd rather connect one.

export function PasskeyDoor({ next, onWallet }: { next: string; onWallet: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"new" | "back" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "new" | "back") {
    setBusy(kind);
    setError(null);
    try {
      await (kind === "new" ? signUpWithPasskey("") : signInWithPasskey());
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-md">
      <button
        onClick={() => go("new")}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ledger px-4 py-3 font-semibold text-white hover:bg-indigo disabled:opacity-60"
      >
        <Fingerprint size={20} aria-hidden />
        {busy === "new" ? "Setting up your account…" : "Create my Bursr account"}
      </button>
      <button
        onClick={() => go("back")}
        disabled={busy !== null}
        className="mt-3 w-full rounded-xl border border-line px-4 py-3 font-semibold hover:border-ink/40 disabled:opacity-60"
      >
        {busy === "back" ? "Check your device…" : "I already have one: sign in"}
      </button>
      <p className="mt-3 text-sm text-muted">
        Bursr uses a passkey: your Face ID, fingerprint or phone PIN. No app to install, nothing to write down. Save it to iCloud Keychain or Google Password Manager so you can use it on your
        other devices.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-refuse">
          {error}
        </p>
      )}

      <button onClick={onWallet} disabled={busy !== null} className="mt-5 text-sm text-muted underline hover:text-ink">
        Use a Stellar wallet instead
      </button>
    </div>
  );
}
