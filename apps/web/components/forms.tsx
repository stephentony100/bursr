"use client";

import { CheckCircle, ShieldCheck } from "@phosphor-icons/react";
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
  inline = false,
}: {
  action: Action;
  children?: React.ReactNode;
  submit: string;
  className?: string;
  tone?: "primary" | "danger" | "quiet";
  /** A button in a row (only hidden fields): no gap above it. */
  inline?: boolean;
}) {
  const [result, formAction, pending] = useActionState(action, null);
  const btn =
    tone === "danger"
      ? "bg-refuse text-card hover:bg-refuse/90"
      : tone === "quiet"
        ? "border border-line bg-card text-ink hover:bg-paper"
        : "bg-ledger text-card hover:bg-indigo";
  return (
    <form action={formAction} className={className}>
      {children}
      <div className={`${children && !inline ? "mt-4" : ""} flex flex-wrap items-center gap-3`}>
        <button type="submit" disabled={pending} className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${btn}`}>
          {pending ? "One moment…" : submit}
        </button>
        {result && (
          <p role="status" className={`text-sm ${result.ok ? "text-ok" : "text-refuse"}`}>
            {result.message}
          </p>
        )}
      </div>
    </form>
  );
}

const SCENARIOS = [
  { id: "normal", label: "A normal payment" },
  { id: "over_cap", label: "One that's too big" },
  { id: "stranger", label: "To a stranger" },
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
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm hover:bg-paper disabled:opacity-60"
          >
            {s.label}
          </button>
        ))}
      </form>
      {result && result.tried && (
        <div
          role="status"
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${result.allowed ? "border-ledger/40 bg-ledger-soft" : "border-refuse/40 bg-refuse-soft"}`}
        >
          <p className="text-muted">We tried: {result.tried}</p>
          <p className="mt-1 flex items-start gap-2 font-medium">
            {result.allowed ? (
              <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-ok" aria-hidden />
            ) : (
              <ShieldCheck size={18} weight="fill" className="mt-0.5 shrink-0 text-refuse" aria-hidden />
            )}
            <span>
              {result.allowed ? "Allowed. " : "Blocked by your spending rules. "}
              {result.message}
            </span>
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
        className={`rounded-lg px-3 py-1.5 text-sm disabled:opacity-60 ${tone === "primary" ? "bg-ledger text-card hover:bg-indigo" : "border border-line bg-card hover:bg-paper"}`}
      >
        {pending ? "One moment" : label}
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
        <button disabled={pending} className="rounded-lg border-2 border-refuse/60 bg-card px-4 py-2 text-sm font-medium text-refuse hover:bg-refuse-soft disabled:opacity-60">
          {pending ? "Trying…" : "Try to sneak a big payment past your limits"}
        </button>
      </form>
      {result && result.tried && (
        <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${result.allowed ? "border-hold/40 bg-hold-soft" : "border-refuse/40 bg-refuse-soft"}`}>
          <p className="text-muted">We tried: {result.tried}</p>
          <p className="mt-1 flex items-start gap-2 font-medium">
            {!result.allowed && <ShieldCheck size={18} weight="fill" className="mt-0.5 shrink-0 text-refuse" aria-hidden />}
            <span>
              {result.allowed ? "" : "Blocked by your spending rules. "}
              {result.message}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
