"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { moveMoneyHomeAction } from "@/app/actions";

// "Move money back to my wallet": only to the owner's own account, inside their limits.

export function MoveHome({ accountId, balance, canMove, limitedBy }: { accountId: string; balance: string; canMove: string; limitedBy: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const nothing = canMove === "$0.00";

  const send = async (f: FormData) => {
    setBusy(true);
    const r = await moveMoneyHomeAction(f);
    setResult(r);
    setBusy(false);
    if (r.ok) router.refresh();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Goes to your own wallet, <span className="num text-ink">{accountId}</span>, and nowhere else. You have {balance} here; you can move {canMove} now.
      </p>
      {limitedBy && <p className="text-sm text-hold">{limitedBy}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await send(new FormData(e.currentTarget));
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="block text-sm font-medium">
          Amount
          <span className="mt-1 flex items-center rounded-xl border border-line bg-card">
            <span className="pl-3 text-muted">$</span>
            <input name="amount" required inputMode="decimal" disabled={nothing} className="num w-32 bg-transparent px-2 py-2 outline-none" />
          </span>
        </label>
        <button disabled={busy || nothing} className="rounded-xl bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60">
          {busy ? "Starting…" : "Move it back"}
        </button>
        <button
          type="button"
          disabled={busy || nothing}
          onClick={async () => {
            const f = new FormData();
            f.set("all", "on");
            await send(f);
          }}
          className="rounded-xl border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-60"
        >
          Move all I can ({canMove})
        </button>
      </form>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-ok" : "text-refuse"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
