import Link from "next/link";
import { Logo } from "@/components/logo";
import { CatchPills } from "@/components/landing/catch-pills";
import { CountUp } from "@/components/landing/count-up";
import { Hero } from "@/components/landing/hero";
import { LimitWall } from "@/components/landing/limit-wall";
import { MiniDeck } from "@/components/landing/mini-deck";
import { CropMarks, RingMark, Rosette, Seal } from "@/components/landing/paper";
import { SealedRoom } from "@/components/landing/sealed-room";
import { Tapes } from "@/components/landing/tapes";
import { WeekScene } from "@/components/landing/week-scene";
import { demoTronAddress } from "@/lib/demo-addresses";

const RULES = [
  { label: "Weekly limit", value: "$2,500.00", body: "The most that can leave your Bursar wallet in a week." },
  { label: "Per payment", value: "$900.00", body: "Anything bigger is refused, even if the AI asks for it." },
  { label: "Only people you added", value: "6 people", body: "A wallet that isn't on your list can't be paid. Only you can add one." },
  { label: "Emergency stop", value: "One button", body: "Pause all payments. Nothing goes out until you turn them back on." },
];

const FIGURES = [
  {
    to: 3.05,
    decimals: 2,
    prefix: "$",
    suffix: "bn",
    label: "lost in 2025 to fake payment requests aimed at businesses that pay suppliers",
    source: "FBI IC3 Internet Crime Report 2025",
    href: "https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf",
  },
  {
    to: 74,
    suffix: "%",
    label: "of US organizations were targeted by this kind of scam that year",
    source: "AFP Payments Fraud and Control Survey 2026",
    href: "https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags",
  },
  {
    to: 126,
    prefix: "$",
    suffix: "k",
    label: "median loss to fraud for firms with fewer than 100 people, the highest of any size",
    source: "ACFE Report to the Nations 2026",
    href: "https://www.acfe.com/-/media/files/acfe/pdfs/rttn/2026/2026-report-to-the-nations.pdf",
  },
  {
    to: 63,
    suffix: "%",
    label: "of Nigeria's digital payment fraud happens in Lagos",
    source: "NIBSS, 2025 data",
    href: "https://nibss-plc.com.ng/nibss-digital-payment-fraud-drops-51-to-%E2%82%A625-85b-in-2025/",
  },
];

const PROOF = [
  "The computer reading your invoices is genuine sealed hardware.",
  "Its security is up to date and not in a test mode.",
  "The proof was made just now, for this check only.",
  "The AI model's graphics chip passed its own check too.",
];

export default function Landing() {
  return (
    <>
      <div aria-hidden className="scroll-progress fixed inset-x-0 top-0 z-[60] h-[3px] bg-gradient-to-r from-mint via-[#f2c14e] to-stamp" />

      <Hero />
      <WeekScene />
      <Tapes />

      {/* What it catches: light, pastel */}
      <section id="catches" className="relative overflow-hidden bg-cream">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[480px] w-[480px] rounded-full bg-[#d9d2ff] opacity-50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[#ffd9c7] opacity-50 blur-3xl" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-28 pt-16">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
            <div>
              <p className="eyebrow text-stamp">What Bursar catches</p>
              <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-7xl">
                Four ways bills
                <br />
                eat your profit.
              </h2>
            </div>
            <p className="max-w-md text-lg leading-relaxed text-ink/70 lg:justify-self-end">
              Every invoice gets all four checks before it can go on your list. When something looks wrong, Bursar holds it and tells you why. It never guesses an amount.
            </p>
          </div>
          <div className="mt-14">
            <CatchPills usualAddress={demoTronAddress("eko-fresh-foods")} newAddress={demoTronAddress("eko-new-account")} />
          </div>
        </div>
      </section>

      {/* Limits: dark blueprint */}
      <section id="limits" className="ledger-grid relative overflow-hidden bg-night text-cream">
        <svg aria-hidden viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
          <circle cx="1300" cy="120" r="300" fill="none" stroke="rgb(251 246 234 / 0.08)" />
          <circle cx="1300" cy="120" r="180" fill="none" stroke="rgb(251 246 234 / 0.08)" strokeDasharray="3 7" />
          <path d="M0 860L1440 300" stroke="rgb(200 50 43 / 0.25)" strokeDasharray="6 8" />
        </svg>
        <div className="relative mx-auto w-full max-w-7xl px-5 py-28">
          <p className="eyebrow text-mint">Limits it can&apos;t break</p>
          <h2 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-7xl">
            The AI does the work. <span className="text-mint">Your wallet keeps the rules.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-cream/70">
            Your limits live in your Bursar wallet, not in the AI. So even a confused or tricked AI can&apos;t go past them. Watch what happens when it tries:
          </p>

          <div className="mt-12">
            <LimitWall />
          </div>

          <div className="relative mt-12 grid border-l border-t border-cream/10 sm:grid-cols-2 lg:grid-cols-4">
            <CropMarks />
            {RULES.map((r) => (
              <div key={r.label} className="border-b border-r border-cream/10 p-7">
                <p className="eyebrow text-cream/50">{r.label}</p>
                <p className="num mt-4 text-3xl text-cream">{r.value}</p>
                <p className="mt-3 text-sm leading-relaxed text-cream/60">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Private by design: light */}
      <section className="bg-paper">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-28 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-ledger">Private by design</p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-6xl">Your invoices are read in a sealed room.</h2>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Bursar reads invoices with NEAR AI, on computers built so that no one, not even the people running them, can see what&apos;s inside. Don&apos;t take our word for it: press{" "}
              <strong className="text-ink">Check the proof</strong> and Bursar checks the hardware&apos;s signed report in front of you.
            </p>
            <p className="mt-4 text-muted">Payments are private too: the amounts you pay aren&apos;t posted for everyone to see.</p>
            <ul className="mt-8 space-y-3 rounded-2xl border border-line bg-card p-6 text-sm shadow-sm">
              <li className="flex items-center gap-2 font-medium text-ledger">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-ledger text-xs text-white">✓</span>
                Proof checked
              </li>
              {PROOF.map((t) => (
                <li key={t} className="flex gap-3 border-t border-line pt-3">
                  <span className="text-ledger">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <SealedRoom />
        </div>
      </section>

      {/* Figures: black, big numbers */}
      <section className="bg-[#050c09] text-cream">
        <div className="mx-auto w-full max-w-7xl px-5 py-28">
          <p className="eyebrow text-[#ff9d95]">Why it matters</p>
          <h2 className="mt-4 max-w-4xl font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-7xl">One wrong payment can cost more than a month&apos;s profit.</h2>
          <dl className="relative mt-16 grid border-l border-t border-cream/10 sm:grid-cols-2 lg:grid-cols-4">
            <CropMarks color="#c8322b" />
            {FIGURES.map((f) => (
              <div key={f.source} className="flex flex-col border-b border-r border-cream/10 p-7">
                <dt className="num text-5xl text-cream lg:text-6xl">
                  <CountUp to={f.to} decimals={f.decimals} prefix={f.prefix} suffix={f.suffix} />
                </dt>
                <dd className="mt-4 flex-1 text-sm leading-relaxed text-cream/60">{f.label}</dd>
                <dd className="mt-6">
                  <a href={f.href} target="_blank" rel="noreferrer" className="eyebrow text-[0.6rem] text-cream/45 underline decoration-cream/20 underline-offset-4 hover:text-cream">
                    {f.source} ↗
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pricing: pastel paper */}
      <section id="pricing" className="relative overflow-hidden bg-[linear-gradient(160deg,#f3efff,#fbf6ea_45%,#e6f5ec)]">
        <Rosette color="#0f6b4f" className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] opacity-[0.08]" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-28 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-ledger">Pricing</p>
            <h2 className="mt-4 font-display text-5xl font-semibold leading-[0.92] tracking-[-0.035em] sm:text-7xl">
              Half a percent.
              <br />
              Shown before you say yes.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/70">
              Bursar charges 0.5% of what it pays out each week. The fee is a line on your weekly list, and each payment shows its transfer fee, so you see the full cost before you approve. No subscription. Nothing to pay in a week with no payments.
            </p>
          </div>
          <div className="mx-auto w-full max-w-md -rotate-2">
            <div className="receipt-edge grain relative rounded-t-2xl bg-[#fffdf6] px-7 pb-12 pt-7 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.5)]">
              <p className="eyebrow text-muted">This week&apos;s list</p>
              <p className="font-display text-xl font-semibold">Bukka Corner Restaurant</p>
              <div className="num mt-6 space-y-3 text-sm">
                <p className="flex justify-between border-b border-dashed border-black/15 pb-3">
                  <span>Staff pay (3 people)</span>
                  <span>$450.00</span>
                </p>
                <p className="flex justify-between border-b border-dashed border-black/15 pb-3">
                  <span>Suppliers (2 invoices)</span>
                  <span>$208.00</span>
                </p>
                <p className="flex justify-between border-b border-dashed border-black/15 pb-3 text-ledger">
                  <span>
                    <span className="relative inline-block">
                      Bursar fee
                      <RingMark color="#0f6b4f" delay={400} />
                    </span>{" "}
                    (0.5% of $658.00)
                  </span>
                  <span>$3.29</span>
                </p>
              </div>
              <p className="mt-5 flex justify-between font-display text-2xl font-semibold">
                <span>Total</span>
                <span className="num">$661.29</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final call */}
      <section className="ledger-grid relative overflow-hidden bg-night text-cream">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgb(79_209_160/0.18),transparent)]" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-20 pt-32 text-center">
          <Seal id="seal-cta" className="mx-auto h-36 w-36 text-cream/60" />
          <h2 className="mx-auto mt-10 max-w-5xl font-display text-[clamp(2.8rem,7vw,7rem)] font-semibold leading-[0.9] tracking-[-0.045em]">
            Spend <span className="text-mint">Friday</span> on your business, not your bills.
          </h2>
          <p className="mx-auto mt-7 max-w-xl text-lg text-cream/70">Walk through a real week with a sample restaurant: six invoices, four problems, one OK. It takes two minutes and uses practice money.</p>
          <Link href="/this-week" className="mt-10 inline-block rounded-full bg-mint px-9 py-4 text-lg font-medium text-night shadow-[0_0_50px_-8px_rgba(79,209,160,0.9)] transition-colors hover:bg-[#7ee3bd]">
            Try it with a sample restaurant
          </Link>
          <p className="mt-4 text-sm text-cream/45">No sign-up. Nothing real is paid.</p>
        </div>
        <footer className="relative border-t border-cream/10">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-xs text-cream/50">
            <Logo tone="light" />
            <nav aria-label="Footer" className="eyebrow flex flex-wrap gap-5 text-[0.62rem]">
              <a href="#how" className="hover:text-cream">How it works</a>
              <a href="#catches" className="hover:text-cream">What it catches</a>
              <a href="#limits" className="hover:text-cream">Your limits</a>
              <a href="#pricing" className="hover:text-cream">Pricing</a>
              <Link href="/this-week" className="text-mint hover:text-cream">Open the demo</Link>
            </nav>
            <span>Payments run on NEAR. Invoices are read privately with NEAR AI.</span>
          </div>
        </footer>
      </section>

      <MiniDeck />
    </>
  );
}
