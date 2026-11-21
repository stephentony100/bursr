"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { parseUnits } from "@/lib/money";
import { stellarMoney } from "./wallet";

// The Stellar edition's wallet page: add USDC to the Bursr wallet (the
// business's vault contract) from the owner's Stellar wallet, or move it back.
// Each is one transaction the owner signs in their wallet.

const USDC_DECIMALS = 7;
const button = "rounded-xl bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60";
const input = "w-32 rounded-xl border border-line bg-card px-3 py-2 text-sm";

function useMoney(kind: "fund" | "withdraw" | "test_usdc", done: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);
  async function run(amount: string) {
    setBusy(true);
    setMsg(null);
    try {
      if (!/^\d{1,7}(\.\d{1,7})?$/.test(amount) || Number(amount) <= 0) throw new Error("Enter an amount, like 25.");
      const r = await stellarMoney(kind, parseUnits(amount, USDC_DECIMALS));
      setMsg({ ok: true, text: done, tx: r.txHash });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, run };
}

function Result({ msg }: { msg: { ok: boolean; text: string; tx?: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-refuse"}`}>
      {msg.text}{" "}
      {msg.tx && (
        <a className="underline" href={`https://stellar.expert/explorer/testnet/tx/${msg.tx}`} target="_blank" rel="noreferrer">
          See it on Stellar
        </a>
      )}
    </p>
  );
}

export function StellarAddMoney({ suggestedUsd, vaultId }: { suggestedUsd: string | null; vaultId: string | null }) {
  const [amount, setAmount] = useState(suggestedUsd ?? "");
  const { busy, msg, run } = useMoney("fund", "Added. Your agent can pay from it now.");
  const test = useMoney("test_usdc", "Done: the test USDC is in your own wallet. Now add it to your Bursr wallet above.");
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-bold">Add USDC from my Stellar wallet</h2>
      <p className="mt-1 text-sm text-muted">One tap: your wallet asks you to confirm, then the USDC lands in your Bursr wallet.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm">$</span>
        <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" aria-label="Amount in dollars" />
        <button className={button} disabled={busy || !vaultId} onClick={() => run(amount)}>
          {busy ? "Check your wallet…" : "Add money"}
        </button>
      </div>
      <Result msg={msg} />
      <div className="mt-5 rounded-xl bg-paper p-4">
        <p className="text-sm font-medium">No test USDC yet?</p>
        <p className="mt-1 text-sm text-muted">Bursr runs on the Stellar test network. One tap gets your wallet $50 of test USDC, paid for with the free test XLM it already has.</p>
        <button className="mt-3 rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-60" disabled={test.busy} onClick={() => test.run("50")}>
          {test.busy ? "Check your wallet…" : "Get $50 of test USDC"}
        </button>
        <Result msg={test.msg} />
        <p className="mt-2 text-xs text-muted">
          Or use{" "}
          <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
            Circle&apos;s faucet
          </a>{" "}
          (Stellar Testnet).
        </p>
      </div>
      {vaultId && (
        <p className="mt-2 break-all text-xs text-muted">
          Your Bursr wallet on Stellar:{" "}
          <a className="underline" href={`https://stellar.expert/explorer/testnet/contract/${vaultId}`} target="_blank" rel="noreferrer">
            {vaultId}
          </a>
        </p>
      )}
    </section>
  );
}

export function StellarMoveHome({ balance }: { balance: string }) {
  const [amount, setAmount] = useState("");
  const { busy, msg, run } = useMoney("withdraw", "Moved back to your wallet.");
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-bold">Move money back to my wallet</h2>
      <p className="mt-1 text-sm text-muted">Only you can do this, even while payments are paused. In your Bursr wallet: {balance}.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm">$</span>
        <input className={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10" aria-label="Amount in dollars" />
        <button className={button} disabled={busy} onClick={() => run(amount)}>
          {busy ? "Check your wallet…" : "Move to my wallet"}
        </button>
      </div>
      <Result msg={msg} />
    </section>
  );
}
