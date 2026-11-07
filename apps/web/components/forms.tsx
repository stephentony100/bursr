"use client";

import { useActionState } from "react";
import type { FormResult, RuleTestResult } from "@/app/actions";

type Action = (prev: FormResult, f: FormData) => Promise<FormResult>;

/** A form wired to a server action, showing its result in plain words. */
export function ActionForm({
  action,
  children,
  submit,
  className = "",
  tone = "primary",
}: {
  action: Action;
  children?: React.ReactNode;
  submit: string;
  className?: string;
  tone?: "primary" | "danger" | "quiet";
}) {
  const [result, formAction, pending] = useActionState(action, null);
  const btn =
    tone === "danger"
      ? "bg-refuse text-white hover:bg-refuse/90"
      : tone === "quiet"
        ? "border border-line bg-card text-ink hover:bg-paper"
        : "bg-ledger text-white hover:bg-ledger/90";
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60 ${btn}`}>
          {pending ? "Working…" : submit}
        </button>
        {result && (
          <p role="status" className={`text-sm ${result.ok ? "text-ledger" : "text-refuse"}`}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}

const SCENARIOS = [
  { id: "normal", label: "A normal payment" },
  { id: "over_cap", label: "Over the single-payment limit" },
  { id: "stranger", label: "To someone not on the list" },
];

/** Asks the agent account what it would do with a payment. Moves nothing. */
export function RuleTester({ action }: { action: (prev: RuleTestResult, f: FormData) => Promise<RuleTestResult> }) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <div>
      <form action={formAction} className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            name="scenario"
            value={s.id}
            disabled={pending}
            className="rounded-md border border-line bg-card px-3 py-2 text-sm hover:bg-paper disabled:opacity-60"
          >
            {s.label}
          </button>
        ))}
      </form>
      {result && result.tried && (
        <div
          role="status"
          className={`mt-4 rounded-md border-l-4 px-4 py-3 text-sm ${result.allowed ? "border-ledger bg-ledger-soft" : "border-refuse bg-refuse-soft"}`}
        >
          <p className="text-muted">Tried: {result.tried}</p>
          <p className="mt-1 font-medium">
            {result.allowed ? "Allowed. " : "Refused by the account. "}
            {result.message}
          </p>
        </div>
      )}
      {result && !result.tried && <p className="mt-3 text-sm text-refuse">{result.message}</p>}
    </div>
  );
}

/** A one-button form for a single plan item (approve on its own, remove). */
export function ItemButton({ action, itemId, label, tone = "quiet" }: { action: Action; itemId: string; label: string; tone?: "primary" | "quiet" }) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <button
        disabled={pending}
        className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-60 ${tone === "primary" ? "bg-ledger text-white hover:bg-ledger/90" : "border border-line bg-card hover:bg-paper"}`}
      >
        {pending ? "…" : label}
      </button>
      {result && !result.ok && <span className="text-xs text-refuse">{result.message}</span>}
    </form>
  );
}

/** PRD §9 step 6: push one payment above the cap straight at the account. */
export function ForceTester({ action }: { action: () => Promise<RuleTestResult> }) {
  const [result, formAction, pending] = useActionState(action, null);
  return (
    <div>
      <form action={formAction}>
        <button disabled={pending} className="rounded-md border-2 border-refuse/60 bg-card px-4 py-2 text-sm font-medium text-refuse hover:bg-refuse-soft disabled:opacity-60">
          {pending ? "Trying…" : "Try to force a payment above your limit"}
        </button>
      </form>
      {result && result.tried && (
        <div role="status" className={`mt-4 rounded-md border-l-4 px-4 py-3 text-sm ${result.allowed ? "border-hold bg-hold-soft" : "border-refuse bg-refuse-soft"}`}>
          <p className="text-muted">Tried: {result.tried}</p>
          <p className="mt-1 font-medium">
            {result.allowed ? "" : "Refused by the account. "}
            {result.message}
          </p>
        </div>
      )}
    </div>
  );
}
