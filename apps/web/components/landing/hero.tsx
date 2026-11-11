import Link from "next/link";
import { readEnv } from "@/lib/env";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";
import { HeroPreview } from "./hero-preview";
import { Reveal } from "./reveal";

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
    <header className="border-b border-line bg-card/80 backdrop-blur-[2px]">
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
              <Link href="/welcome" className="rounded-lg bg-ledger px-3 py-1.5 font-semibold text-white hover:bg-indigo">
                Get started
              </Link>
            </>
          ) : (
            <Link href="/this-week" className="rounded-lg border border-line px-3 py-1.5 font-medium text-ink hover:border-ink/40">
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
      className={`press group inline-flex items-center gap-2 rounded-lg px-5 py-3 font-semibold ${tone === "accent" ? "bg-ledger text-white hover:bg-indigo" : "bg-white text-ink hover:bg-paper"} ${className}`}
    >
      Try it with a sample restaurant
      <ArrowRight size={18} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function Hero() {
  return (
    <section className="bg-paper">
      <SiteNav />
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ledger" /> Payments for small businesses, on NEAR
          </p>
          <Reveal as="h1" className="display mt-6 text-[clamp(2.5rem,4.4vw,3.75rem)] leading-[1.04]">
            Pay everyone.
            <br />
            Never the wrong person.
          </Reveal>
          <p className="mt-6 max-w-[38ch] text-lg leading-relaxed text-muted">
            Bursr checks every supplier invoice, then pays your suppliers and staff after one OK. Never past your limits.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <TryButton />
            <Link href="/welcome" className="group inline-flex items-center gap-1.5 font-semibold text-ink hover:text-indigo">
              Set up your business
              <ArrowRight size={16} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}
