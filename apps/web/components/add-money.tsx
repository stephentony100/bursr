"use client";

import { useState } from "react";
import { depositAddressAction, noticeTopUpAction, oneTapDepositAction, type DepositResult } from "@/app/actions";
import { parseUnits } from "@/lib/money";
import { wallet } from "./wallet";

// Adding money to the agent's wallet. Live: one tap from the owner's NEAR
// wallet, or a one-time address (with QR) for USDC on any other chain.
// Nothing to copy for the one-tap path; the agent announces arrivals.

const OTHER_CHAINS = [
  { symbol: "USDC", chain: "base", label: "USDC on Base" },
  { symbol: "USDC", chain: "sol", label: "USDC on Solana" },
  { symbol: "USDC", chain: "sui", label: "USDC on Sui" },
  { symbol: "USDC", chain: "eth", label: "USDC on Ethereum" },
  { symbol: "USDC", chain: "arb", label: "USDC on Arbitrum" },
  { symbol: "USDT", chain: "tron", label: "USDT on Tron" },
  { symbol: "USDC", chain: "near", label: "USDC on NEAR (from an exchange)" },
];

const button = "rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60";

export function AddMoney({ suggestedUsd }: { suggestedUsd: string | null }) {
  const [tab, setTab] = useState<"near" | "other">("near");
  return (
    <div className="rounded-xl border border-line bg-card">
      <div role="tablist" aria-label="How to add money" className="flex border-b border-line text-sm">
        {(
          [
            ["near", "From my NEAR wallet (one tap)"],
            ["other", "From another wallet or exchange"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 px-4 py-3 font-medium ${tab === id ? "border-b-2 border-ledger text-ink" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-5">{tab === "near" ? <OneTap suggestedUsd={suggestedUsd} /> : <OtherChain />}</div>
    </div>
  );
}

function OneTap({ suggestedUsd }: { suggestedUsd: string | null }) {
  const [amount, setAmount] = useState(suggestedUsd ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      if (!/^\d{1,7}(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) throw new Error("Enter an amount, like 250.");
      const info = await oneTapDepositAction();
      if (!info.ok) throw new Error(info.message);
      const d = info.deposit;
      const w = await wallet();
      await w.signAndSendTransaction({
        receiverId: d.tokenContract,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: { receiver_id: "intents.near", amount: parseUnits(amount, d.decimals).toString(), msg: d.agentAccount },
              gas: "100000000000000",
              deposit: "1",
            },
          },
        ],
      });
      await noticeTopUpAction();
      setMsg({ ok: true, text: `Sent $${amount} ${d.symbol} from your wallet. Your agent will say here when it has arrived (usually within a minute).` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Your wallet app asks you to confirm one transfer of USDC to your Bursar wallet. Nothing to copy. You need a little NEAR (about 0.01) in your wallet for the network fee.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          Amount
          <span className="mt-1 flex items-center rounded-md border border-line bg-card">
            <span className="pl-3 text-muted">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="num w-32 bg-transparent px-2 py-2 outline-none" />
          </span>
        </label>
        <button onClick={send} disabled={busy} className={button}>
          {busy ? "Check your wallet app…" : "Add money"}
        </button>
      </div>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-ledger" : "text-refuse"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function OtherChain() {
  const [choice, setChoice] = useState(OTHER_CHAINS[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DepositResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function getAddress() {
    setBusy(true);
    setResult(null);
    setCopied(false);
    setResult(await depositAddressAction(choice.symbol, choice.chain));
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Pick the network your money is on. Bursar gives you an address just for this deposit; whatever you send there is changed into your Bursar wallet&apos;s dollars,
        and your agent tells you when it arrives.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">
          My money is in
          <select
            value={`${choice.symbol}@${choice.chain}`}
            onChange={(e) => setChoice(OTHER_CHAINS.find((c) => `${c.symbol}@${c.chain}` === e.target.value)!)}
            className="mt-1 block rounded-md border border-line bg-card px-3 py-2"
          >
            {OTHER_CHAINS.map((c) => (
              <option key={`${c.symbol}@${c.chain}`} value={`${c.symbol}@${c.chain}`}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button onClick={getAddress} disabled={busy} className={button}>
          {busy ? "Getting an address…" : "Get my deposit address"}
        </button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-refuse">
          {result.message}
        </p>
      )}
      {result?.ok && (
        <div className="flex flex-wrap gap-5 rounded-lg border border-line bg-paper p-4">
          <div className="h-48 w-48 shrink-0 rounded bg-white p-1" aria-label={`QR code of the deposit address`} dangerouslySetInnerHTML={{ __html: result.qrSvg }} />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p className="font-medium">
              Send {result.address.symbol} on {result.address.chainName} to:
            </p>
            <p className="num break-all rounded bg-card px-2 py-1.5">{result.address.address}</p>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(result.address.address);
                setCopied(true);
              }}
              className="rounded-md border border-line bg-card px-3 py-1.5 font-medium hover:border-ink/40"
            >
              {copied ? "Copied" : "Copy address"}
            </button>
            {result.address.memo && (
              <p className="font-medium text-refuse">Also include this memo, or the money is lost: {result.address.memo}</p>
            )}
            <p className="text-muted">
              Only send {result.address.symbol} on {result.address.chainName}.{result.address.minimum && ` At least ${result.address.minimum} ${result.address.symbol}.`}
              {result.address.openUntil && ` This address works until ${new Date(result.address.openUntil).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
