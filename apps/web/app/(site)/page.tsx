import Link from "next/link";
import { InvoiceDeck } from "@/components/landing/invoice-deck";
import { LimitRuler } from "@/components/landing/limit-ruler";
import { Logo } from "@/components/logo";

const WEEK = [
  {
    day: "Mon–Thu",
    title: "Invoices come in",
    body: "Snap a photo of each invoice and upload it. Bursar reads each one privately: who it's from, what you bought, how much, and where they want the money.",
  },
  {
    day: "As they arrive",
    title: "Every invoice is checked",
    body: "Is this really your supplier? Have you paid this one already? Did their bank details change? Are the prices what you agreed? Anything odd is held for you.",
  },
  {
    day: "Friday",
    title: "One list, one OK",
    body: "Staff pay and clean invoices go on one list with the total and the transfer fees. You read it, then approve everyone with a single tap.",
  },
  {
    day: "Minutes later",
    title: "Everyone is paid",
    body: "Each person gets paid in digital dollars on the network they chose, and you get a record your accountant can open in a spreadsheet.",
  },
];

const CATCHES = [
  {
    stamp: "Blocked",
    tone: "text-stamp border-stamp",
    title: "Look-alike names",
    example: "“Ek0 Fresh Foods” with a zero is not Eko Fresh Foods.",
  },
  {
    stamp: "Hold",
    tone: "text-hold border-hold",
    title: "The same bill twice",
    example: "Invoice #MPF-0412 arrived again on Wednesday. Paid once is enough.",
  },
  {
    stamp: "Blocked",
    tone: "text-stamp border-stamp",
    title: "Changed bank details",
    example: "“Please pay our new account” is the oldest trick there is. Only you can change where someone gets paid.",
  },
  {
    stamp: "Hold",
    tone: "text-hold border-hold",
    title: "Prices creeping up",
    example: "Tomatoes at $23.40 a crate when you agreed $18.00. That's 30% more.",
  },
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

export default function Landing() {
  return (
    <>
      <div className="scroll-progress fixed inset-x-0 top-0 z-50 h-[3px] bg-mint" aria-hidden />

      {/* Hero */}
      <section className="ledger-grid relative overflow-hidden bg-night text-cream">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(60%_80%_at_50%_100%,rgb(79_209_160/0.16),transparent)]" />
        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
          <Logo tone="light" />
          <nav className="flex items-center gap-5 text-sm">
            <a href="#how" className="hidden text-cream/70 hover:text-cream sm:inline">How it works</a>
            <a href="#safe" className="hidden text-cream/70 hover:text-cream sm:inline">Your limits</a>
            <a href="#pricing" className="hidden text-cream/70 hover:text-cream sm:inline">Pricing</a>
            <Link href="/this-week" className="rounded-full bg-cream px-4 py-2 font-medium text-night hover:bg-white">
              Open Bursar
            </Link>
          </nav>
        </header>

        <div className="relative mx-auto w-full max-w-6xl px-5 pb-6 pt-14 text-center sm:pt-20">
          <p className="eyebrow text-mint">For shops, restaurants and small teams</p>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            Pay everyone.
            <br />
            <span className="text-mint">Never the wrong person.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-cream/75">
            Bursar reads your supplier invoices, catches the fakes and the overcharges, and pays your suppliers and staff once a week, after one OK from you. It can never spend more than the limits you set.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/this-week" className="rounded-full bg-mint px-6 py-3 font-medium text-night hover:bg-[#6fe0b6]">
              Try it with a sample restaurant
            </Link>
            <a href="#how" className="rounded-full border border-cream/25 px-6 py-3 font-medium text-cream hover:border-cream/60">
              See how a week works
            </a>
          </div>
          <p className="mt-3 text-xs text-cream/50">No sign-up. Practice money only. Nothing real is paid.</p>
        </div>

        <div className="relative pb-4">
          <InvoiceDeck />
          <p className="eyebrow relative pb-8 text-center text-cream/50">
            This week at a Lagos restaurant: 6 invoices in, 2 ready to pay, 4 stopped
          </p>
        </div>
      </section>

      {/* How a week works */}
      <section id="how" className="bg-paper">
        <div className="mx-auto w-full max-w-6xl px-5 py-24">
          <p className="eyebrow text-ledger">How a week works</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Your bills, sorted by Friday.
          </h2>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {WEEK.map((s, i) => (
              <li key={s.title} className="bg-card p-6">
                <div className="flex items-baseline justify-between">
                  <span className="num text-3xl text-ledger">0{i + 1}</span>
                  <span className="eyebrow text-muted">{s.day}</span>
                </div>
                <h3 className="mt-6 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What it catches */}
      <section className="border-y border-line bg-cream">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-24 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow text-stamp">What Bursar catches</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              The four ways small businesses lose money on bills.
            </h2>
            <p className="mt-5 text-muted">
              Every invoice gets all four checks before it can go on your list. When something looks wrong, Bursar holds it and tells you why in one plain sentence. It never guesses an amount.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {CATCHES.map((c, i) => (
              <li key={c.title} className="relative rounded-2xl border border-black/10 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                <span
                  className={`eyebrow absolute right-5 top-5 rounded-md border-2 px-2 py-0.5 text-[0.65rem] font-semibold ${c.tone}`}
                  style={{ transform: `rotate(${i % 2 ? 5 : -5}deg)` }}
                >
                  {c.stamp}
                </span>
                <h3 className="pr-20 font-display text-xl font-semibold">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{c.example}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Limits */}
      <section id="safe" className="ledger-grid bg-night text-cream">
        <div className="mx-auto w-full max-w-6xl px-5 py-24">
          <p className="eyebrow text-mint">Limits it can&apos;t break</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The AI does the work. Your wallet keeps the rules.
          </h2>
          <p className="mt-5 max-w-2xl text-cream/70">
            You set a weekly limit, a limit per payment, and the people Bursar may pay. Those rules live in your Bursar wallet, not in the AI, so even a confused or tricked AI can&apos;t go past them. Only you can add someone new or change where they get paid.
          </p>

          <LimitRuler />

          <div className="mt-14 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-night-line bg-night-2 p-6">
              <p className="eyebrow text-cream/50">Weekly limit</p>
              <p className="num mt-2 text-3xl">$2,500</p>
              <p className="mt-2 text-sm text-cream/60">The most that can leave your wallet in a week.</p>
            </div>
            <div className="rounded-2xl border border-night-line bg-night-2 p-6">
              <p className="eyebrow text-cream/50">Per payment</p>
              <p className="num mt-2 text-3xl">$900</p>
              <p className="mt-2 text-sm text-cream/60">A $5,000 payment is refused, even if the AI asks for it.</p>
            </div>
            <div className="rounded-2xl border border-stamp/40 bg-stamp/10 p-6">
              <p className="eyebrow text-[#ffb4ae]">Emergency stop</p>
              <p className="mt-2 font-display text-2xl font-semibold">Pause all payments</p>
              <p className="mt-2 text-sm text-cream/60">One button. Nothing goes out until you turn payments back on.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-paper">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-ledger">Private by design</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Your invoices are read in a sealed room.
            </h2>
            <p className="mt-5 text-muted">
              Bursar reads invoices with NEAR AI, on computers built so that no one, not even the people running them, can see what&apos;s inside. You don&apos;t have to take our word for it: press <strong className="text-ink">Check the proof</strong> and Bursar checks the hardware&apos;s signed report in front of you.
            </p>
            <p className="mt-4 text-muted">Payments are private too: the amounts you pay aren&apos;t posted for everyone to see.</p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm">
            <p className="flex items-center gap-2 font-medium text-ledger">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ledger text-xs text-white">✓</span>
              Proof checked
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              {[
                "The computer reading your invoices is genuine sealed hardware.",
                "Its security is up to date and not in a test mode.",
                "The proof was made just now, for this check only.",
                "The AI model's graphics chip passed its own check too.",
              ].map((t) => (
                <li key={t} className="flex gap-3 border-t border-line pt-3 first:border-0 first:pt-0">
                  <span className="text-ledger">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Figures */}
      <section className="border-y border-line bg-cream">
        <div className="mx-auto w-full max-w-6xl px-5 py-24">
          <p className="eyebrow text-stamp">Why it matters</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            One wrong payment can cost more than a month&apos;s profit.
          </h2>
          <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
            {FIGURES.map((f) => (
              <div key={f.figure} className="flex flex-col bg-cream p-6">
                <dt className="num text-4xl text-ink">{f.figure}</dt>
                <dd className="mt-3 flex-1 text-sm text-muted">{f.label}</dd>
                <dd className="mt-4">
                  <a href={f.href} target="_blank" rel="noreferrer" className="eyebrow text-[0.62rem] text-muted underline hover:text-ink">
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
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-ledger">Pricing</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Half a percent. Shown before you say yes.
            </h2>
            <p className="mt-5 text-muted">
              Bursar charges 0.5% of what it pays out each week. The fee is a line on your weekly list, next to the transfer fees, so you see the full cost before you approve. No subscription, nothing to pay in a week with no payments.
            </p>
          </div>
          <div className="num rounded-2xl border border-line bg-card p-6 text-sm shadow-sm">
            <p className="eyebrow text-muted">This week&apos;s list</p>
            <div className="mt-4 space-y-2">
              <p className="flex justify-between"><span>Staff pay (3 people)</span><span>$450.00</span></p>
              <p className="flex justify-between"><span>Suppliers (2 invoices)</span><span>$208.00</span></p>
              <p className="flex justify-between text-ledger"><span>Bursar fee (0.5% of $658.00)</span><span>$3.29</span></p>
            </div>
            <p className="mt-4 flex justify-between border-t border-line pt-4 text-base font-medium text-ink">
              <span>Total</span>
              <span>$661.29</span>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="ledger-grid bg-night text-cream">
        <div className="mx-auto w-full max-w-6xl px-5 py-24 text-center">
          <h2 className="mx-auto max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">
            Spend Friday on your business, not your bills.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-cream/70">
            Walk through a real week with a sample restaurant: six invoices, four problems, one OK. It takes two minutes and uses practice money.
          </p>
          <Link href="/this-week" className="mt-8 inline-block rounded-full bg-mint px-7 py-3.5 font-medium text-night hover:bg-[#6fe0b6]">
            Try it with a sample restaurant
          </Link>
        </div>
        <footer className="border-t border-night-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-cream/50">
            <Logo tone="light" />
            <span>Payments run on NEAR. Invoices are read privately with NEAR AI.</span>
          </div>
        </footer>
      </section>
    </>
  );
}
