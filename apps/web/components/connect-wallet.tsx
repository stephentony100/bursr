"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { friendlyError } from "@/lib/errors";
import { nearWallets, signInWithNear, signInWithStellar, signInWithSui, STELLAR_EDITION, STELLAR_WALLETS, watchSuiWallets, type WalletChoice } from "./wallet";

// Live mode sign-in: choose a chain, then a wallet on that chain. A new chain
// is one more entry in CHAINS with its own wallet list and sign-in. The Stellar
// edition offers Stellar only, so it opens straight on the Stellar wallets.

type Chain = "near" | "sui" | "stellar";

const CHAINS: { id: Chain; name: string; beta?: boolean }[] = STELLAR_EDITION
  ? [{ id: "stellar", name: "Stellar" }]
  : [
      { id: "near", name: "NEAR" },
      { id: "sui", name: "Sui", beta: true },
    ];

const NO_WALLET: Record<Chain, string> = {
  near: "No NEAR wallet found. Install HOT Wallet, create an account, then come back.",
  sui: "No Sui wallet found in this browser. Install Slush (slush.app), then come back.",
  stellar: "Install Freighter (freighter.app), or use Albedo, which needs no install.",
};

const row = "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-paper disabled:opacity-60";

function ChainLogo({ id, size = 32 }: { id: Chain; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/networks/${id}.svg`} alt="" width={size} height={size} style={{ width: size, height: size }} className="shrink-0" />;
}

/** `next`: where to go once signed in (the first open setup step, or the owner's business). */
export function ConnectWallet({ next = "/welcome" }: { next?: string }) {
  const router = useRouter();
  const [chain, setChain] = useState<Chain | null>(CHAINS.length === 1 ? CHAINS[0].id : null);
  const [wallets, setWallets] = useState<WalletChoice[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chain) return;
    if (chain === "sui") return watchSuiWallets(setWallets);
    if (chain === "stellar") return; // a fixed list (below)
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
      await (chain === "stellar" ? signInWithStellar(w.id) : chain === "sui" ? signInWithSui(w.id) : signInWithNear(w.id));
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const name = CHAINS.find((c) => c.id === chain)?.name;
  const shown = chain === "stellar" ? STELLAR_WALLETS : wallets;

  return (
    <div className="max-w-md">
      {!chain ? (
        <>
          <h2 className="font-semibold">Choose a chain</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
            {CHAINS.map((c) => (
              <li key={c.id}>
                <button onClick={() => choose(c.id)} className={row}>
                  <ChainLogo id={c.id} />
                  <span className="font-medium">{c.name}</span>
                  {c.beta && <span className="rounded-full bg-hold-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-hold">BETA</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            {CHAINS.length > 1 && (
            <button
              onClick={() => choose(null)}
              disabled={busy !== null}
              aria-label="Back to chains"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line hover:border-ink/40 disabled:opacity-60"
            >
              <ArrowLeft size={16} aria-hidden />
            </button>
            )}
            <h2 className="font-semibold">Connect to {name}</h2>
          </div>
          {shown === null ? (
            <p className="mt-4 text-sm text-muted">Looking for wallets…</p>
          ) : shown.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{NO_WALLET[chain]}</p>
          ) : (
            <ul className="mt-3 max-h-[22rem] space-y-0.5 overflow-y-auto pr-1">
              {shown.map((w) => (
                <li key={w.id}>
                  <button onClick={() => pick(w)} disabled={busy !== null} className={row}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.icon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1 truncate font-medium">{w.name}</span>
                    {busy === w.id && <span className="text-sm text-muted">Check your wallet…</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-refuse">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center gap-2 text-sm text-muted">
        {CHAINS.map((c) => (
          <ChainLogo key={c.id} id={c.id} size={18} />
        ))}
        <span>Works on {CHAINS.map((c) => c.name).join(" and ")}</span>
      </div>
    </div>
  );
}
