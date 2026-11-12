import Link from "next/link";
import { CheckCircle, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";
import { readEnv } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { StartButton } from "./hero";
import { CountUp } from "./count-up";

// The quieter sections of the home page: privacy, the problem in numbers,
// pricing and the closing call. Plain layouts in the shared product style.

const PROOF = [
  "The computer reading your invoices is genuine sealed hardware.",
  "Its security is up to date and not in a test mode.",
  "The proof was made just now, for this check only.",
  "The AI model's graphics chip passed its own check too.",
];

const FIGURES = [
  {
    figure: "$3.05bn",
    label: "lost in 2025 to fake payment requests aimed at businesses that pay suppliers",
    source: "FBI IC3 Internet Crime Report 2025",
    href: "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf",
  },
  {
    figure: "74%",
    label: "of US organizations were targeted by this kind of scam that year",
    source: "AFP Payments Fraud and Control Survey 2026",
    href: "https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags",
  },
  {
    figure: "$126k",
    label: "median loss to fraud for firms with fewer than 100 people, the highest of any size",
    source: "ACFE Report to the Nations 2026",
    href: "https://www.acfe.com/-/media/files/acfe/pdfs/rttn/2026/2026-report-to-the-nations.pdf",
  },
  {
    figure: "63%",
    label: "of Nigeria's digital payment fraud happens in Lagos",
    source: "NIBSS, 2025 data",
    href: "https://nibss-plc.com.ng/nibss-digital-payment-fraud-drops-51-to-%E2%82%A625-85b-in-2025/",
  },
];

export function Privacy() {
  return (
    <section aria-labelledby="privacy-title" className="bg-paper">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
        <div>
          <h2 id="privacy-title" className="display text-4xl leading-[1.05] sm:text-5xl">
            Your invoices are read privately.
          </h2>
          <p className="mt-5 max-w-[56ch] text-lg leading-relaxed text-muted">
            Bursr reads invoices with NEAR AI, on computers built so that no one, not even the people running them, can see what&apos;s inside. Press <strong className="font-semibold text-ink">Check the proof</strong> and
            Bursr checks the hardware&apos;s signed report in front of you.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="flex items-center gap-2 font-semibold">
              <LockSimple size={18} weight="bold" className="text-ledger" aria-hidden /> Your invoices stay private
            </p>
            <Badge tone="ready">Proof checked</Badge>
          </div>
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {PROOF.map((t) => (
              <li key={t} className="flex gap-3 py-3 text-sm">
                <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-ledger" aria-hidden />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Figures() {
  return (
    <section aria-labelledby="figures-title" className="border-y border-line bg-card">
      <div className="mx-auto w-full max-w-7xl px-5 py-24">
        <h2 id="figures-title" className="display max-w-3xl text-4xl leading-[1.05] sm:text-5xl">
          One wrong payment can cost more than a month&apos;s profit.
        </h2>
        <dl className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map((f) => (
            <div key={f.source} className="flex flex-col bg-card p-6">
              <dt className="num font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-tight">
                <CountUp value={f.figure} />
              </dt>
              <dd className="mt-3 flex-1 text-sm leading-relaxed text-muted">{f.label}</dd>
              <dd className="mt-5">
                <a href={f.href} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-line hover:text-ink">
                  {f.source}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const PRICE_ROWS: [string, string][] = [
  ["Staff pay, 3 people", "$450.00"],
  ["Suppliers, 2 invoices", "$208.00"],
];

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="bg-paper">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
        <div>
          <h2 id="pricing-title" className="display text-4xl leading-[1.05] sm:text-5xl">
            Half a percent, shown before you approve.
          </h2>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">
            0.5% of each payment run, as its own line on the list. You also cover each network fee, so everyone gets their full pay. No subscription, and nothing to pay in a quiet week.
          </p>
        </div>
        <div className="w-full max-w-md justify-self-center rounded-2xl border border-line bg-card">
          <p className="border-b border-line px-6 py-4 text-sm font-semibold">This week&apos;s list · Bukka Corner Restaurant</p>
          <dl className="divide-y divide-line px-6 text-sm">
            {PRICE_ROWS.map(([k, v]) => (
              <div key={k} className="flex justify-between py-3">
                <dt className="text-muted">{k}</dt>
                <dd className="num">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between py-3 font-medium text-ledger">
              <dt>Bursr fee, 0.5% of $658.00</dt>
              <dd className="num">$3.29</dd>
            </div>
          </dl>
          <p className="flex justify-between border-t border-line bg-paper px-6 py-4 text-lg font-semibold">
            <span>Total</span>
            <span className="num">$661.29</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function Closing() {
  const live = readEnv().BURSAR_MODE === "live";
  return (
    <section aria-labelledby="close-title" className="bg-night text-white">
      <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-24">
        <h2 id="close-title" className="display max-w-4xl text-4xl leading-[1.05] sm:text-6xl">
          Spend Friday on your business, not your bills.
        </h2>
        <p className="mt-6 max-w-xl text-lg text-white/70">Set your limits once. Your agent pays everyone on time, and stops what looks wrong.</p>
        <StartButton className="mt-10" tone="light" />
      </div>
      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <p className="mx-auto -mb-[0.18em] max-w-7xl bg-gradient-to-b from-white/[0.14] to-white/0 bg-clip-text px-5 font-[family-name:var(--font-display)] text-[clamp(7rem,26vw,22rem)] font-extrabold leading-none tracking-[-0.06em] text-transparent">
          Bursr
        </p>
      </div>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-7 text-sm text-white/65">
          <Logo tone="light" />
          <nav aria-label="Footer" className="flex flex-wrap gap-6">
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#checks" className="hover:text-white">What it checks</a>
            <a href="#limits" className="hover:text-white">Your limits</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link href={live ? "/signin" : "/this-week"} className="text-white underline decoration-white/40 hover:decoration-white">{live ? "Sign in" : "Open the app"}</Link>
          </nav>
          <span>Payments run on NEAR. Invoices are read privately with NEAR AI.</span>
        </div>
      </footer>
    </section>
  );
}
