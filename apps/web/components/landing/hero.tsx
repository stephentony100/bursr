import Link from "next/link";
import { readEnv } from "@/lib/env";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";
import { Payday } from "./payday";
import { RotatingWord } from "./rotating-word";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#checks", label: "What it checks" },
  { href: "#limits", label: "Your limits" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteNav() {
  // Live: returning owners sign in, new ones get started. Practice mode opens the sample at once.
  const live = readEnv().BURSAR_MODE === "live";
  return (
    <header className="relative z-10">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5">
        <Link href="/" aria-label="Bursr home">
          <Logo />
        </Link>
        <nav aria-label="Home page" className="flex items-center gap-7 text-sm">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hidden text-muted transition-colors hover:text-ink md:inline">
              {n.label}
            </a>
          ))}
          {live ? (
            <>
              <Link href="/signin" className="font-medium text-ink hover:text-indigo">
                Sign in
              </Link>
              <Link href="/welcome" className="rounded-full bg-ledger px-4 py-2 font-semibold text-white hover:bg-indigo">
                Get started
              </Link>
            </>
          ) : (
            <Link href="/this-week" className="rounded-full bg-ink px-4 py-2 font-semibold text-white hover:bg-night-2">
              Open the app
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function TryButton({ className = "", tone = "accent" }: { className?: string; tone?: "accent" | "light" }) {
  return (
    <Link
      href="/this-week"
      className={`press group inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-semibold ${tone === "accent" ? "bg-ledger text-white hover:bg-indigo" : "bg-white text-ink hover:bg-paper"} ${className}`}
    >
      Try it with a sample restaurant
      <ArrowRight size={18} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_60%_at_75%_30%,rgba(47,75,219,0.14),transparent_70%),radial-gradient(40%_40%_at_10%_10%,rgba(242,179,61,0.12),transparent_70%)]" />
      <SiteNav />
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-6 px-5 pb-16 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold text-muted">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> Payday on autopilot · built on NEAR
          </p>
          <h1 className="display mt-6 text-[clamp(2.5rem,4.6vw,3.9rem)] font-extrabold leading-[1.02] tracking-[-0.045em]">
            <span className="sr-only">Pay your staff and suppliers. Never the wrong person.</span>
            <span aria-hidden>
              Pay your <RotatingWord words={["chef.", "tomato seller.", "cashier.", "gas supplier.", "whole team."]} className="text-ledger" />
              <br />
              Never the wrong person.
            </span>
          </h1>
          <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-muted">
            An AI agent pays your staff and suppliers in digital dollars, on any network. It checks every invoice and can&apos;t go past your limits.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <TryButton />
            <Link href="/welcome" className="group inline-flex items-center gap-1.5 font-semibold text-ink hover:text-indigo">
              Set up your business
              <ArrowRight size={16} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {[
              ["Any network", "NEAR, Base, Solana, Tron and more"],
              ["0.5%", "per payment run, nothing else"],
              ["Limits", "locked in your wallet, not the AI"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-[family-name:var(--font-display)] font-extrabold">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Payday />
      </div>
    </section>
  );
}
