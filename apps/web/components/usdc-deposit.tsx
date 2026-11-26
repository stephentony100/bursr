"use client";

import { useState } from "react";

// Add USDC straight to the Bursr wallet: its address on Stellar, as text and a
// QR code. Nothing passes through Bursr. The vault is a contract (C…), which
// some exchanges can't send to yet, so the card says what to do then.

export function UsdcDeposit({ address, qrSvg, cap, testnet }: { address: string; qrSvg: string; cap: string; testnet: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-bold">Add USDC to my Bursr wallet</h2>
      <p className="mt-1 text-sm text-muted">
        Send USDC on Stellar{testnet ? " (test network)" : ""} to this address. It lands in your Bursr wallet, where only your limits let it out. Your wallet holds up to {cap} for now.
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-48 w-48 shrink-0 rounded bg-white p-1" aria-label="QR code of your Bursr wallet's address" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="min-w-0 space-y-3 text-sm">
          <p className="num break-all rounded-xl bg-paper p-3">{address}</p>
          <button
            className="rounded-xl border border-line bg-card px-4 py-2 font-semibold hover:border-ink/40"
            onClick={() => {
              void navigator.clipboard.writeText(address);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy address"}
          </button>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Only USDC on Stellar (Circle&apos;s). Other coins or networks can be lost.</li>
            <li>This is a contract address (it starts with C). If your exchange won&apos;t send to it, send the USDC to your own Stellar wallet first, then from there to here.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
