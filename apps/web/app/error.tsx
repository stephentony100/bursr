"use client";

import Link from "next/link";
import { useEffect } from "react";

// Shown when a page fails to load. Plain words, a way to retry, and the
// details stay in the browser console for whoever is fixing it.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[bursar] page error", error);
  }, [error]);
  return (
    <div className="grid min-h-[60vh] place-items-center px-5">
      <div className="max-w-md rounded-2xl border border-line bg-card p-8">
        <h1 className="display text-2xl">This page didn&apos;t load</h1>
        <p className="mt-2 text-muted">
          Something went wrong on our side. No money moved because of this, and your agent keeps working in the background. Try again, and if it keeps happening, tell
          us what you were doing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={reset} className="rounded-xl bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo">
            Try again
          </button>
          <Link href="/this-week" className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-ink/40">
            Go to This week
          </Link>
        </div>
        {error.digest && <p className="mt-4 text-xs text-muted">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
