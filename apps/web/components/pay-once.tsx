"use client";

import { Copy, WhatsappLogo } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { payOnceAction, type PayOnceResult } from "@/app/actions";
import { chainName } from "@/lib/chains";
import type { PayoutToken } from "@/lib/domain";

// "Pay someone once": a quick job, a delivery, a repair. Their address, or a
// link they fill in; the agent pays as soon as they're approved, and (if the
// owner wants) takes them off the list afterwards.

const input = "mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2";

export function PayOnce({ tokens, live }: { tokens: PayoutToken[]; live: boolean }) {
  const router = useRouter();
  const [method, setMethod] = useState<"link" | "address">("link");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PayOnceResult | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget; // read before awaiting
          setBusy(true);
          setCopied(false);
          const r = await payOnceAction(new FormData(form));
          setResult(r);
          setBusy(false);
          if (r.ok) {
            form.reset();
            router.refresh();
          }
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label className="block text-sm font-medium">
          Their name
          <input name="name" required className={input} />
        </label>
        <label className="block text-sm font-medium">
          Amount
          <span className="mt-1 flex items-center rounded-xl border border-line bg-card">
            <span className="pl-3 text-muted">$</span>
            <input name="amount" required inputMode="decimal" className="num w-full bg-transparent px-2 py-2 outline-none" />
          </span>
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          What it&apos;s for
          <input name="note" placeholder="e.g. Fixing the generator" className={input} />
        </label>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">How do we get their details?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["link", "Send them a link (they fill it in)"],
                ["address", "I have their wallet address"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${method === id ? "border-ledger bg-ledger-soft" : "border-line"}`}>
                <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {method === "address" && (
          <>
            <label className="block text-sm font-medium">
              They want to be paid in
              <select name="token" required className={input}>
                {tokens.map((t) => (
                  <option key={t.assetId} value={t.assetId}>
                    {t.symbol} on {chainName(t.chain)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Their wallet address
              <input name="address" required spellCheck={false} className={`${input} num text-sm`} />
            </label>
          </>
        )}

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="removeAfterPaid" defaultChecked />
          Take them off my list once they&apos;re paid
        </label>

        <div className="sm:col-span-2">
          <button disabled={busy} className="rounded-xl bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60">
            {busy ? "Setting it up…" : method === "link" ? "Make their link" : live ? "Add them and pay" : "Pay them now"}
          </button>
        </div>
      </form>

      {result && !result.ok && (
        <p role="alert" className="text-sm text-refuse">
          {result.message}
        </p>
      )}
      {result?.ok && (
        <div role="status" className="rounded-xl border border-ledger/40 bg-ledger-soft/60 p-4 text-sm">
          {result.link ? (
            <>
              <p className="font-medium">Send this link to {result.name}:</p>
              <p className="num mt-2 break-all rounded bg-card px-2 py-1.5">{result.link}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(result.link!);
                    setCopied(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-1.5 font-semibold hover:bg-paper"
                >
                  <Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hi ${result.name}, please tell me where to send your payment: ${result.link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-1.5 font-semibold hover:bg-paper"
                >
                  <WhatsappLogo size={16} aria-hidden /> Send on WhatsApp
                </a>
              </div>
              <p className="mt-2 text-muted">{result.message}</p>
            </>
          ) : (
            <p>{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
