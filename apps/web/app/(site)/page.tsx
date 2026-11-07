import Link from "next/link";
import { CheckCircle, HandCoins, Pause, UserCheck } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/logo";
import { CatchPills } from "@/components/landing/catch-pills";
import { Hero, TryButton } from "@/components/landing/hero";
import { LimitWall } from "@/components/landing/limit-wall";
import { GuillocheBand } from "@/components/landing/paper";
import { SealedRoom } from "@/components/landing/sealed-room";
import { ClearingTape } from "@/components/landing/tapes";
import { WeekScene } from "@/components/landing/week-scene";
import { demoNearImplicit, demoTronAddress } from "@/lib/demo-addresses";

const RULES = [
  { icon: HandCoins, label: "Weekly limit", value: "$2,500.00", body: "The most that can leave your Bursar wallet in a week." },
  { icon: CheckCircle, label: "Per payment", value: "$900.00", body: "Anything bigger is refused, even if the AI asks for it." },
  { icon: UserCheck, label: "Only people you added", value: "6 people", body: "A wallet that isn't on your list can't be paid. Only you can add one." },
  { icon: Pause, label: "Emergency stop", value: "One button", body: "Pause all payments. Nothing goes out until you turn them back on." },
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

const PROOF = [
  "The computer reading your invoices is genuine sealed hardware.",
  "Its security is up to date and not in a test mode.",
  "The proof was made just now, for this check only.",
  "The AI model's graphics chip passed its own check too.",
];

export default function Landing() {
  return (
    <>
      <div aria-hidden className="scroll-progress fixed inset-x-0 top-0 z-[60] h-[3px] bg-ledger" />

      <Hero account={demoNearImplicit("mama-put-farms")} />
      <WeekScene />
      <ClearingTape />

      {/* What it checks */}
      <section id="checks" className="bg-paper">
        <div className="mx-auto w-full max-w-7xl px-5 py-24">
          <h2 className="display max-w-3xl text-5xl leading-[0.95] sm:text-6xl">Four ways bills eat your profit.</h2>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink/75">
            Every invoice gets all four checks before it can go on your list. When something looks wrong, Bursar holds it and tells you why. It never guesses an amount.
          </p>
          <div className="mt-14">
            <CatchPills usualAddress={demoTronAddress("eko-fresh-foods")} newAddress={demoTronAddress("eko-new-account")} />
          </div>
        </div>
      </section>

      {/* Limits */}
      <section id="limits" className="border-y border-ink/10 bg-paper-2">
        <div className="mx-auto w-full max-w-7xl px-5 py-24">
          <h2 className="display max-w-4xl text-5xl leading-[0.95] sm:text-6xl">The AI does the work. Your wallet keeps the rules.</h2>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink/75">
            Your limits live in your Bursar wallet, not in the AI, so even a confused or tricked AI can&apos;t go past them. Watch what happens when it tries.
          </p>
          <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <LimitWall />
            <dl className="space-y-6">
              {RULES.map((r) => {
                const Glyph = r.icon;
                return (
                  <div key={r.label} className="grid grid-cols-[2.5rem_1fr] gap-x-4">
                    <dt className="row-span-2 grid h-10 w-10 place-items-center rounded-full border border-ink/20 bg-card">
                      <Glyph size={18} weight="bold" aria-hidden />
                    </dt>
                    <dd className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-bold [font-stretch:108%]">{r.label}</span>
                      <span className={`text-ledger ${r.value.startsWith("$") ? "num" : "font-semibold"}`}>{r.value}</span>
                    </dd>
                    <dd className="mt-1 text-sm leading-relaxed text-ink/70">{r.body}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </section>

      {/* Private by design */}
      <section className="bg-paper">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
          <div>
            <h2 className="display text-5xl leading-[0.95] sm:text-6xl">Your invoices are read in a sealed room.</h2>
            <p className="mt-6 max-w-[56ch] text-lg leading-relaxed text-ink/75">
              Bursar reads invoices with NEAR AI, on computers built so that no one, not even the people running them, can see what&apos;s inside. Press{" "}
              <strong className="font-semibold text-ink">Check the proof</strong> and Bursar checks the hardware&apos;s signed report in front of you. The amounts you pay stay private too.
            </p>
            <ul className="mt-8 space-y-3">
              {PROOF.map((t) => (
                <li key={t} className="flex gap-3 text-[0.95rem]">
                  <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-ledger" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <SealedRoom />
        </div>
      </section>

      {/* Why it matters */}
      <section className="border-y border-ink/10 bg-paper-2">
        <div className="mx-auto w-full max-w-7xl px-5 py-24">
          <h2 className="display max-w-4xl text-5xl leading-[0.95] sm:text-6xl">One wrong payment can cost more than a month&apos;s profit.</h2>
          <dl className="mt-16 grid gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FIGURES.map((f) => (
              <div key={f.source} className="flex flex-col border-l border-ink/40 pl-5 pr-6">
                <dt className="num text-5xl font-semibold leading-none text-ink">{f.figure}</dt>
                <dd className="mt-4 flex-1 text-sm leading-relaxed text-ink/75">{f.label}</dd>
                <dd className="mt-5">
                  <a href={f.href} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-ink/25 hover:text-ink hover:decoration-ink">
                    {f.source}
                  </a>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-24 lg:grid-cols-2">
          <div>
            <h2 className="display text-5xl leading-[0.95] sm:text-6xl">Half a percent, shown before you sign.</h2>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink/75">
              Bursar charges 0.5% of what it pays out each week. The fee is a line on your weekly list, and each payment shows its transfer fee, so you see the full cost before you approve. No subscription, and nothing to pay in a week with no payments.
            </p>
          </div>
          <div className="mx-auto w-full max-w-md">
            <div className="relative overflow-hidden rounded-t-[6px] border border-ink/20 border-b-2 border-b-ink/35 bg-card px-7 pb-9 pt-7 [border-bottom-style:dotted]">
              <GuillocheBand className="pointer-events-none absolute inset-x-0 top-0 h-12 w-full" opacity={0.22} />
              <p className="field-label relative text-muted">Counterfoil, this week</p>
              <p className="relative text-xl font-bold [font-stretch:110%]">Bukka Corner Restaurant</p>
              <div className="mt-6 space-y-3 text-sm">
                <p className="flex justify-between border-b border-dotted border-ink/30 pb-3">
                  <span>Staff pay, 3 people</span>
                  <span className="num">$450.00</span>
                </p>
                <p className="flex justify-between border-b border-dotted border-ink/30 pb-3">
                  <span>Suppliers, 2 invoices</span>
                  <span className="num">$208.00</span>
                </p>
                <p className="flex justify-between border-b border-dotted border-ink/30 pb-3 font-semibold text-ledger">
                  <span>Bursar fee, 0.5% of $658.00</span>
                  <span className="num">$3.29</span>
                </p>
              </div>
              <p className="mt-5 flex justify-between border-t-2 border-ink pt-3 text-2xl font-bold">
                <span>Total</span>
                <span className="num">$661.29</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="bg-night text-card">
        <div className="mx-auto w-full max-w-7xl px-5 pb-20 pt-28">
          <h2 className="display max-w-5xl text-[clamp(2.8rem,6.4vw,6rem)] leading-[0.92]">Spend Friday on your business, not your bills.</h2>
          <p className="mt-7 max-w-xl text-lg text-card/75">Walk through a real week with a sample restaurant: six invoices, four problems, one OK. It takes two minutes and uses practice money.</p>
          <TryButton className="mt-10" />
        </div>
        <footer className="border-t border-card/15">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-7 text-sm text-card/65">
            <Logo tone="light" />
            <nav aria-label="Footer" className="flex flex-wrap gap-6">
              <a href="#how" className="hover:text-card">How it works</a>
              <a href="#checks" className="hover:text-card">What it checks</a>
              <a href="#limits" className="hover:text-card">Your limits</a>
              <a href="#pricing" className="hover:text-card">Pricing</a>
              <Link href="/this-week" className="text-card underline decoration-card/40 hover:decoration-card">Open the app</Link>
            </nav>
            <span>Payments run on NEAR. Invoices are read privately with NEAR AI.</span>
          </div>
        </footer>
      </section>
    </>
  );
}
