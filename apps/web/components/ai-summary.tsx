"use client";

import { useActionState } from "react";
import type { AiSummary } from "@/lib/summary";

export function AiSummaryButton({ action }: { action: () => Promise<AiSummary> }) {
  const [result, run, pending] = useActionState(action, null);
  return (
    <div className="mt-3">
      <form action={run}>
        <button disabled={pending} className="rounded-md border border-line bg-card px-3 py-1.5 text-sm hover:bg-paper disabled:opacity-60">
          {pending ? "Writing…" : "Have NEAR AI write it in friendlier words"}
        </button>
      </form>
      {result &&
        (result.ok ? (
          <blockquote className="mt-3 border-l-4 border-indigo/40 pl-4 text-sm">
            {result.text}
            <footer className="mt-1 text-xs text-muted">
              Written privately by {result.model} on NEAR AI Cloud. Every figure was checked against your records.
            </footer>
          </blockquote>
        ) : (
          <p className="mt-2 text-sm text-hold">{result.reason}</p>
        ))}
    </div>
  );
}
