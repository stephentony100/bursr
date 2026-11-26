"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { NIGERIAN_BANKS, PRACTICE_BANK } from "@/lib/banks";
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

/** The one-time details Linq needs before it takes naira from a business (real money only). */
function VerifyForNaira({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", nin: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const field = (k: keyof typeof f, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input className={`${input} mt-1 w-full`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </label>
  );
  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      await post("/api/ramp", { step: "verify", ...f });
      onDone();
    } catch (e) {
      setMsg(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 rounded-xl bg-paper p-4">
      <p className="text-sm">Once only: Linq, our naira partner, needs to know who is paying in. Use your details as they are on your ID.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field("firstName", "First name", { autoComplete: "given-name" })}
        {field("lastName", "Last name", { autoComplete: "family-name" })}
        {field("email", "Email", { type: "email", autoComplete: "email" })}
        {field("phone", "Phone", { inputMode: "tel", autoComplete: "tel", placeholder: "08012345678" })}
        {field("nin", "NIN (11 digits)", { inputMode: "numeric", maxLength: 11 })}
      </div>
      <p className="mt-2 text-xs text-muted">Your NIN goes straight to Linq to confirm it&apos;s you. Bursr doesn&apos;t keep it.</p>
      <button className={`${button} mt-3`} disabled={busy} onClick={submit}>
        {busy ? "Checking…" : "Verify my details"}
      </button>
      {msg && (
        <p role="alert" className="mt-2 text-sm text-refuse">
          {msg}
        </p>
      )}
    </div>
  );
}

export function NairaIn({ suggestedUsd, practice, needsVerify }: { suggestedUsd: string | null; practice: boolean; needsVerify: boolean }) {
  const router = useRouter();
  const [amount, setAmount] = useState(suggestedUsd ?? "");
  const [order, setOrder] = useState<RampOrderView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const orderId = order?.id ?? null;
  const waiting = order !== null && !order.practice && (order.status === "awaiting_payment" || order.status === "paying" || order.status === "delivering");

  // Real naira: check every 15 seconds until the money lands (Linq's webhook may have done it already).
  useEffect(() => {
    if (!waiting || !orderId) return;
    const t = setInterval(async () => {
      try {
        const now = await post<RampOrderView | null>("/api/ramp", { step: "in_status", orderId });
        if (!now) return;
        setOrder(now);
        if (now.status === "done") {
          setMsg({ ok: true, text: `${now.usd} is in your Bursr wallet. Your agent can pay from it now.` });
          router.refresh();
        } else if (now.status === "failed") setMsg({ ok: false, text: "This deposit didn't complete. If you sent naira, Linq returns it to your bank." });
      } catch {
        /* keep waiting */
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [waiting, orderId, router]);

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
      {needsVerify ? (
        <VerifyForNaira onDone={() => router.refresh()} />
      ) : !order || order.status === "done" || order.status === "failed" ? (
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
            Send <strong className="num">{order.ngn}</strong>
            {order.fee ? <> (includes Linq&apos;s {order.fee} fee)</> : null} for <strong className="num">{order.usd}</strong> before {until(order.expiresAt)}:
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">Bank</dt>
            <dd>{order.bankName}</dd>
            <dt className="text-muted">Account</dt>
            <dd className="num">{order.accountNumber}</dd>
            <dt className="text-muted">Name</dt>
            <dd>{order.accountName}</dd>
            {order.practice && (
              <>
                <dt className="text-muted">Reference</dt>
                <dd className="num break-all">{order.reference}</dd>
              </>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {order.practice ? (
              <button className={button} disabled={busy} onClick={() => go("paid")}>
                {busy ? "Adding it to your wallet…" : "I've sent it"}
              </button>
            ) : (
              <p className="text-muted">
                {order.status === "awaiting_payment" ? "Waiting for your transfer. This page updates by itself, or you can leave it." : "Transfer received. Your USDC is on its way to your Bursr wallet."}
              </p>
            )}
            <button className={quiet} disabled={busy} onClick={() => (setOrder(null), setMsg(null))}>
              {waiting ? "Hide" : "Start again"}
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
  const [bank, setBank] = useState(practice ? PRACTICE_BANK.code : "");
  const [account, setAccount] = useState("");
  const [order, setOrder] = useState<RampOrderView | null>(null);
  const [busy, setBusy] = useState<"check" | "confirm" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);

  async function check() {
    setBusy("check");
    setMsg(null);
    try {
      setOrder(await post<RampOrderView>("/api/ramp", { step: "out_start", usd: usdMicros(amount), bankCode: bank, accountNumber: account }));
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
            {practice && <option value={PRACTICE_BANK.code}>{PRACTICE_BANK.name}</option>}
            {NIGERIAN_BANKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
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
