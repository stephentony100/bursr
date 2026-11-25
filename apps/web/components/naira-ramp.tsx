"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { parseUnits, USD_DECIMALS } from "@/lib/money";
import type { RampOrderView } from "@/lib/ramp-orders";
import { stellarNetwork } from "@/lib/stellar-network";
import { confirmCashOut, post } from "./wallet";

// Naira in and out on the Wallet page (lib/ramp-orders.ts). Add money: an
// amount → where to send the naira → it lands in the Bursr wallet. Cash out:
// an amount and a bank account → who it goes to → one passkey tap → paid.

const button = "rounded-xl bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60";
const quiet = "rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-60";
const input = "rounded-xl border border-line bg-card px-3 py-2 text-sm";

const BANKS = ["Access Bank", "Ecobank", "Fidelity Bank", "First Bank", "FCMB", "GTBank", "Kuda", "Moniepoint", "Opay", "Palmpay", "Stanbic IBTC", "Sterling Bank", "UBA", "Union Bank", "Wema Bank", "Zenith Bank"];

function usdMicros(amount: string): string {
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) <= 0) throw new Error("Enter an amount in dollars, like 25.");
  return parseUnits(amount.trim(), USD_DECIMALS).toString();
}

function until(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Practice({ on }: { on: boolean }) {
  if (!on) return null;
  return <span className="ml-2 rounded-full bg-hold-soft px-2 py-0.5 text-[11px] font-bold tracking-wide text-hold">PRACTICE</span>;
}

function TxLink({ hash }: { hash: string | null }) {
  if (!hash) return null;
  return (
    <a className="underline" href={`${stellarNetwork().explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
      See it on Stellar
    </a>
  );
}

export function NairaIn({ suggestedUsd, practice }: { suggestedUsd: string | null; practice: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(suggestedUsd ?? "");
  const [order, setOrder] = useState<RampOrderView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function go(step: "start" | "paid") {
    setBusy(true);
    setMsg(null);
    try {
      if (step === "start") setOrder(await post<RampOrderView>("/api/ramp", { step: "in_start", usd: usdMicros(amount) }));
      else {
        const done = await post<RampOrderView>("/api/ramp", { step: "in_paid", orderId: order!.id });
        setOrder(done);
        setMsg({ ok: true, text: `Added ${done.usd}. Your agent can pay from it now.` });
        router.refresh();
      }
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-bold">
        Add money from naira
        <Practice on={practice} />
      </h2>
      <p className="mt-1 text-sm text-muted">Send naira by bank transfer. It arrives in your Bursr wallet as dollars (USDC).</p>
      {!order || order.status === "done" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm">$</span>
          <input className={`${input} w-32`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25" aria-label="Amount in dollars" />
          <button className={button} disabled={busy} onClick={() => go("start")}>
            {busy ? "One moment…" : "Show me where to send it"}
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-paper p-4 text-sm">
          <p>
            Send <strong className="num">{order.ngn}</strong> for <strong className="num">{order.usd}</strong> ({order.rate}) before {until(order.expiresAt)}:
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Bank</dt>
            <dd>{order.bankName}</dd>
            <dt className="text-muted">Account</dt>
            <dd className="num">{order.accountNumber}</dd>
            <dt className="text-muted">Name</dt>
            <dd>{order.accountName}</dd>
            <dt className="text-muted">Reference</dt>
            <dd className="num break-all">{order.reference}</dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {order.practice ? (
              <button className={button} disabled={busy} onClick={() => go("paid")}>
                {busy ? "Adding it to your wallet…" : "I've sent it"}
              </button>
            ) : (
              <p className="text-muted">Your money arrives as soon as the transfer reaches Linq. You can leave this page.</p>
            )}
            <button className={quiet} disabled={busy} onClick={() => (setOrder(null), setMsg(null))}>
              Start again
            </button>
          </div>
          {order.practice && <p className="mt-2 text-xs text-muted">Practice: no naira moves. Bursr adds test USDC to your Bursr wallet on the Stellar test network.</p>}
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-refuse"}`}>
          {msg.text} {msg.ok && <TxLink hash={order?.txHash ?? null} />}
        </p>
      )}
    </section>
  );
}

export function NairaOut({ balance, practice, withPasskey }: { balance: string; practice: boolean; withPasskey: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState(practice ? "Practice Bank" : "");
  const [account, setAccount] = useState("");
  const [order, setOrder] = useState<RampOrderView | null>(null);
  const [busy, setBusy] = useState<"check" | "confirm" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);

  async function check() {
    setBusy("check");
    setMsg(null);
    try {
      setOrder(await post<RampOrderView>("/api/ramp", { step: "out_start", usd: usdMicros(amount), bankName: bank, accountNumber: account }));
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    setBusy("confirm");
    setMsg(null);
    try {
      const r = await confirmCashOut(order!.id);
      setMsg({ ok: true, text: `Sent. ${order!.ngn} is on its way to ${order!.accountName}.${order!.practice ? " (Practice: no naira moves.)" : ""}`, tx: r.txHash });
      setOrder(null);
      setAmount("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-base font-bold">
        Cash out to my bank
        <Practice on={practice} />
      </h2>
      <p className="mt-1 text-sm text-muted">Only you can do this, even while payments are paused. In your Bursr wallet: {balance}.</p>
      {!order ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">$</span>
            <input className={`${input} w-28`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="20" aria-label="Amount in dollars" />
          </div>
          <select className={input} value={bank} onChange={(e) => setBank(e.target.value)} aria-label="Your bank">
            <option value="">Your bank</option>
            {practice && <option>Practice Bank</option>}
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <input className={input} inputMode="numeric" maxLength={10} value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, ""))} placeholder="Account number" aria-label="Account number" />
          <button className={button} disabled={busy !== null} onClick={check}>
            {busy === "check" ? "Checking…" : "Continue"}
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-xl bg-paper p-4 text-sm">
          <p>
            <strong className="num">{order.ngn}</strong> to <strong>{order.accountName}</strong>, {order.bankName} <span className="num">{order.accountNumber}</span>
          </p>
          <p className="mt-1 text-muted">
            {order.usd} from your Bursr wallet, at {order.rate}. Confirm before {until(order.expiresAt)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={button} disabled={busy !== null} onClick={confirm}>
              {busy === "confirm" ? (withPasskey ? "Check the passkey prompt…" : "Check your wallet…") : withPasskey ? "Confirm with my passkey" : "Confirm in my wallet"}
            </button>
            <button className={quiet} disabled={busy !== null} onClick={() => setOrder(null)}>
              Change
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-refuse"}`}>
          {msg.text} {msg.tx && <TxLink hash={msg.tx} />}
        </p>
      )}
    </section>
  );
}
