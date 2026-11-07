import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";
import { Cheque } from "./cheque";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#checks", label: "What it checks" },
  { href: "#limits", label: "Your limits" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteNav() {
  return (
    <header className="bg-night text-card">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-6 px-5">
        <Link href="/" aria-label="Bursar home" className="press">
          <Logo tone="light" />
        </Link>
        <nav aria-label="Home page" className="flex items-center gap-7 text-sm">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hidden text-card/75 transition-colors hover:text-card md:inline">
              {n.label}
            </a>
          ))}
          <Link href="/this-week" className="font-semibold text-card underline decoration-card/40 hover:decoration-card">
            Open the app
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function TryButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/this-week"
      className={`press group inline-flex items-center gap-2.5 rounded-[6px] bg-ledger px-6 py-3.5 font-semibold text-card hover:bg-indigo ${className}`}
    >
      Try it with a sample restaurant
      <ArrowRight size={18} weight="bold" aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

export function Hero({ account }: { account: string }) {
  return (
    <section className="bg-paper">
      <SiteNav />
      <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-12 lg:pt-16">
        <h1 className="display max-w-[16ch] text-[clamp(2.7rem,6.6vw,6rem)] leading-[0.94] lg:max-w-none">
          Pay everyone.
          <br />
          Never the wrong person.
        </h1>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:mt-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)]">
          <div className="lg:pt-6">
            <p className="max-w-[34ch] text-lg leading-relaxed text-ink/80">
              Bursar checks every supplier invoice, then pays your suppliers and staff after one OK. Never past your limits.
            </p>
            <TryButton className="mt-7" />
          </div>
          <Cheque account={account} />
        </div>
      </div>
    </section>
  );
}
