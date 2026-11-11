"use client";

import { Copy, WhatsappLogo } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { createInviteAction, onboardLimitsAction, type InviteResult } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import type { PayoutToken, Rules } from "@/lib/domain";
import { formatUnits, USD_DECIMALS } from "@/lib/money";
import { chainName } from "@/lib/chains";
import { signInWithWallet } from "./wallet";
import { friendlyError } from "@/lib/errors";

// The interactive parts of /welcome. Each form posts to a server action that
// saves and returns to /welcome, which then shows the next step.

const input = "mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2";

export function ConnectWallet() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await signInWithWallet();
            router.refresh();
          } catch (e) {
            setError(friendlyError(e));
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
        className="rounded-lg bg-ledger px-5 py-3 font-semibold text-white hover:bg-indigo disabled:opacity-60"
      >
        {busy ? "Check your wallet app…" : "Connect my wallet"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-refuse">
          {error}
        </p>
      )}
    </div>
  );
}

/** Fills the time zone with the browser's own, so most owners never touch it. */
const noSubscribe = () => () => {};
export function TimeZoneField({ current }: { current: string | null }) {
  // The browser's zone on the client, a safe default while rendering on the server.
  const detected = useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos", () => "Africa/Lagos");
  const [picked, setTz] = useState<string | null>(null);
  const tz = picked ?? current ?? detected;
  const zones = Array.from(new Set([tz, "Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Europe/London", "America/New_York", "Asia/Dubai", "Asia/Kolkata"]));
  return (
    <label className="block text-sm font-medium">
      Time zone <span className="font-normal text-muted">(your agent pays on your calendar days)</span>
      <select name="timeZone" value={tz} onChange={(e) => setTz(e.target.value)} className={input}>
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

const PRESETS = [
  { id: "small", label: "Small team", weekly: "500", single: "200", ask: "100" },
  { id: "growing", label: "Growing business", weekly: "2500", single: "900", ask: "500" },
  { id: "test", label: "Just testing", weekly: "5", single: "2", ask: "1" },
] as const;

export function LimitsForm({ rules, tokens }: { rules: Rules; tokens: PayoutToken[] }) {
  const usd = (micros: string) => formatUnits(BigInt(micros), USD_DECIMALS).replace(/\.?0+$/, "");
  const [v, setV] = useState({ weekly: usd(rules.weeklyCapUsd), single: usd(rules.perPaymentCapUsd), ask: usd(rules.approvalThresholdUsd) });
  const chosen = new Set(rules.payoutTokens.map((t) => t.assetId));
  return (
    <ActionForm action={onboardLimitsAction} submit="Save and continue" className="space-y-6">
      <fieldset>
        <legend className="text-sm font-medium">Start from</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setV({ weekly: p.weekly, single: p.single, ask: p.ask })}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${v.weekly === p.weekly && v.single === p.single ? "border-ledger bg-ledger-soft" : "border-line hover:border-ink/40"}`}
            >
              <span className="block font-semibold">{p.label}</span>
              <span className="text-muted">
                ${Number(p.weekly).toLocaleString()} a week · ${Number(p.single).toLocaleString()} a payment
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["weeklyCap", "weekly", "Weekly limit", "The most your agent can send in any 7 days."],
            ["perPaymentCap", "single", "Largest single payment", "Anything bigger is stopped, always."],
            ["approvalThreshold", "ask", "Ask me first above", "Bigger payments wait for your OK."],
          ] as const
        ).map(([name, key, label, hint]) => (
          <label key={name} className="block text-sm font-medium">
            {label}
            <span className="mt-1 flex items-center rounded-lg border border-line bg-card">
              <span className="pl-3 text-muted">$</span>
              <input name={name} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} inputMode="decimal" className="num w-full bg-transparent px-2 py-2 outline-none" />
            </span>
            <span className="mt-1 block font-normal text-muted">{hint}</span>
          </label>
        ))}
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-line bg-paper p-4 text-sm">
        <input type="checkbox" name="autopilot" defaultChecked={rules.autopilot} className="mt-1" />
        <span>
          <span className="font-medium">Autopilot: my agent pays routine payments without asking me.</span>{" "}
          <span className="text-muted">People you&apos;ve paid before, under &quot;Ask me first above&quot;, with invoices that passed every check. Everything else waits for your OK.</span>
        </span>
      </label>
      <label className="block text-sm font-medium">
        Pay supplier invoices
        <select name="invoiceTiming" defaultValue={rules.invoiceTiming} className={`${input} max-w-sm`}>
          <option value="due">The day before they&apos;re due</option>
          <option value="asap">As soon as they pass every check</option>
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Ways people can ask to be paid</legend>
        <p className="text-sm text-muted">Digital dollars on these networks. You can change this later.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {tokens.filter((t) => chosen.has(t.assetId)).map((t) => (
            <NetworkBox key={t.assetId} t={t} checked />
          ))}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-indigo">More networks</summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {tokens.filter((t) => !chosen.has(t.assetId)).map((t) => (
              <NetworkBox key={t.assetId} t={t} checked={false} />
            ))}
          </div>
        </details>
      </fieldset>
    </ActionForm>
  );
}

function NetworkBox({ t, checked }: { t: PayoutToken; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="payoutToken" value={t.assetId} defaultChecked={checked} />
      {t.symbol} on {chainName(t.chain)}
    </label>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [group, setGroup] = useState(false);
  return (
    <div className="space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget; // read before awaiting: React clears currentTarget afterwards
          setBusy(true);
          setCopied(false);
          const r = await createInviteAction(new FormData(form));
          setResult(r);
          setBusy(false);
          if (r.ok) {
            form.reset();
            router.refresh();
          }
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <fieldset className="sm:col-span-2">
          <legend className="sr-only">Who is this link for?</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                [false, "One person"],
                [true, "A whole group (one link for everyone)"],
              ] as const
            ).map(([value, label]) => (
              <label key={label} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${group === value ? "border-ledger bg-ledger-soft" : "border-line"}`}>
                <input type="radio" name="groupChoice" checked={group === value} onChange={() => setGroup(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {group && <input type="hidden" name="group" value="on" />}
        </fieldset>
        <label className="block text-sm font-medium">
          {group ? "Group name" : "Their name"}
          <input name="name" required placeholder={group ? "e.g. Kitchen staff" : undefined} className={input} />
        </label>
        <label className="block text-sm font-medium">
          They are
          <select name="category" defaultValue="staff" className={input}>
            <option value="staff">Staff</option>
            <option value="supplier">A supplier</option>
            <option value="software">A subscription or service</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Regular pay <span className="font-normal text-muted">{group ? "(optional, same for everyone)" : "(optional)"}</span>
          <span className="mt-1 flex items-center rounded-lg border border-line bg-card">
            <span className="pl-3 text-muted">$</span>
            <input name="recurringAmount" inputMode="decimal" className="num w-full bg-transparent px-2 py-2 outline-none" />
          </span>
        </label>
        <label className="block text-sm font-medium">
          Every
          <select name="recurringEvery" defaultValue="week" className={input}>
            <option value="week">Week (on payday)</option>
            <option value="two_weeks">2 weeks</option>
            <option value="month">Month (first payday)</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <button disabled={busy} className="rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60">
            {busy ? "Making the link…" : group ? "Make the group link" : "Make their invite link"}
          </button>
        </div>
      </form>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-refuse">
          {result.message}
        </p>
      )}
      {result?.ok && (
        <div className="rounded-lg border border-ledger/40 bg-ledger-soft/60 p-4 text-sm">
          <p className="font-medium">
            {result.group
              ? `Share this link in your ${result.name} group chat. Each person types their name and how they want to be paid; you approve them all at once on People. It works for 14 days.`
              : `Send this link to ${result.name}. They choose how they want to be paid; you approve it before anything is paid.`}
          </p>
          <p className="num mt-2 break-all rounded bg-card px-2 py-1.5">{result.link}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                void navigator.clipboard.writeText(result.link);
                setCopied(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 font-medium hover:border-ink/40"
            >
              <Copy size={16} aria-hidden /> {copied ? "Copied" : "Copy link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(result.group ? `Hi all, please tell me how you'd like to be paid: ${result.link}` : `Hi ${result.name}, please tell me how you'd like to be paid: ${result.link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-3 py-1.5 font-medium hover:border-ink/40"
            >
              <WhatsappLogo size={16} aria-hidden /> Send on WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
