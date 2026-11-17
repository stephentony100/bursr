"use client";

import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { nearWallets, signInWithNear, signInWithSui, watchSuiWallets, type WalletChoice } from "./wallet";

// Live mode sign-in: connect → choose a chain → pick a wallet on that chain.
// More chains are more cards here, each with its own wallet list and sign-in.

type Chain = "near" | "sui";

const CHAINS: { id: Chain; name: string; hint: string }[] = [
  { id: "near", name: "NEAR", hint: "HOT Wallet, Meteor, MyNearWallet…" },
  { id: "sui", name: "Sui", hint: "Slush, Suiet, Phantom…" },
];

const NO_WALLET: Record<Chain, string> = {
  near: "No NEAR wallet found. Install HOT Wallet, create an account, then come back.",
  sui: "No Sui wallet found in this browser. Install Slush (slush.app), then come back.",
};

/** Where to go once signed in (the first open setup step, or the owner's business). */
export function ConnectWallet({ next = "/welcome" }: { next?: string }) {
  const router = useRouter();
  const [chain, setChain] = useState<Chain | null>(null);
  const [wallets, setWallets] = useState<WalletChoice[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chain) return;
    if (chain === "sui") return watchSuiWallets(setWallets);
    let live = true;
    nearWallets()
      .then((list) => live && setWallets(list))
      .catch((e) => live && (setError(friendlyError(e)), setWallets([])));
    return () => {
      live = false;
    };
  }, [chain]);

  function choose(c: Chain | null) {
    setError(null);
    setWallets(null);
    setChain(c);
  }

  async function pick(w: WalletChoice) {
    setBusy(w.id);
    setError(null);
    try {
      await (chain === "sui" ? signInWithSui(w.id) : signInWithNear(w.id));
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const row = "flex w-full items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left hover:border-ink/40 disabled:opacity-60";

  return (
    <div className="space-y-3">
      {!chain ? (
        <>
          <p className="text-sm font-semibold">Which chain is your wallet on?</p>
          <ul className="space-y-2">
            {CHAINS.map((c) => (
              <li key={c.id}>
                <button onClick={() => choose(c.id)} className={row}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/networks/${c.id}.svg`} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block truncate text-sm text-muted">{c.hint}</span>
                  </span>
                  <CaretRight size={16} aria-hidden className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <button onClick={() => choose(null)} disabled={busy !== null} className="flex items-center gap-1 text-sm font-medium text-indigo">
            <ArrowLeft size={14} aria-hidden /> Other chains
          </button>
          <p className="text-sm font-semibold">Choose your {chain === "sui" ? "Sui" : "NEAR"} wallet</p>
          {wallets === null ? (
            <p className="text-sm text-muted">Looking for wallets…</p>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-muted">{NO_WALLET[chain]}</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {wallets.map((w) => (
                <li key={w.id}>
                  <button onClick={() => pick(w)} disabled={busy !== null} className={row}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.icon} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
                    {busy === w.id ? <span className="text-sm text-muted">Check your wallet…</span> : <CaretRight size={16} aria-hidden className="text-muted" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-refuse">
          {error}
        </p>
      )}
    </div>
  );
}
