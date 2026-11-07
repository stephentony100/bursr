import Link from "next/link";
import { Logo } from "@/components/logo";
import { RingMark, Seal } from "./paper";

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#catches", label: "What it catches" },
  { href: "#limits", label: "Your limits" },
  { href: "#pricing", label: "Pricing" },
];

/** Drafting lines behind the headline; each solid line draws itself in once. */
function Blueprint() {
  const line = "rgb(251 246 234 / 0.13)";
  return (
    <svg aria-hidden viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
      <circle cx="720" cy="1040" r="780" fill="none" stroke={line} pathLength={1} className="draw" />
      <circle cx="720" cy="430" r="360" fill="none" stroke={line} strokeDasharray="3 7" className="fade-up" style={{ animationDelay: "600ms" }} />
      <circle cx="1210" cy="150" r="118" fill="none" stroke={line} pathLength={1} className="draw" style={{ animationDelay: "300ms" }} />
      <path d="M1210 20v260M1080 150h260" stroke={line} pathLength={1} className="draw" style={{ animationDelay: "500ms" }} />
      <circle cx="210" cy="720" r="160" fill="none" stroke={line} pathLength={1} className="draw" style={{ animationDelay: "200ms" }} />
      <path d="M97 607l226 226M323 607L97 833" stroke={line} pathLength={1} className="draw" style={{ animationDelay: "700ms" }} />
      <path d="M0 900L720 430L1440 -40" stroke="rgb(79 209 160 / 0.35)" strokeDasharray="6 8" className="fade-up" style={{ animationDelay: "900ms" }} />
      <path d="M0 -40L720 430L1440 900" stroke={line} strokeDasharray="6 8" className="fade-up" style={{ animationDelay: "1000ms" }} />
    </svg>
  );
}

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-night text-cream">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_82%_8%,rgb(79_209_160/0.20),transparent),radial-gradient(50%_60%_at_8%_95%,rgb(56_74_190/0.30),transparent),radial-gradient(40%_40%_at_50%_120%,rgb(200_50_43/0.18),transparent)]" />
      <div aria-hidden className="ledger-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,#000_35%,transparent_80%)]" />
      <Blueprint />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Bursar home">
          <Logo tone="light" />
        </Link>
        <nav aria-label="Home page" className="flex items-center gap-1 rounded-xl border border-cream/10 bg-night-2/80 p-1 backdrop-blur">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="eyebrow hidden rounded-lg px-3 py-2 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream md:inline-block">
              {n.label}
            </a>
          ))}
          <Link href="/this-week" className="eyebrow rounded-lg bg-mint px-3.5 py-2 font-semibold text-night transition-colors hover:bg-[#7ee3bd]">
            Open the demo →
          </Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-36 pt-6 text-center">
        <Link
          href="/this-week"
          className="fade-up group inline-flex items-center gap-3 rounded-full border border-cream/15 bg-night-2/70 py-1 pl-4 pr-1 text-sm backdrop-blur transition-colors hover:border-mint/50"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-mint" />
          <span className="text-cream/75">Practice mode. No sign-up.</span>
          <span className="eyebrow rounded-full bg-cream px-3 py-1.5 text-night transition-colors group-hover:bg-mint">Try it →</span>
        </Link>

        <h1 className="fade-up mt-8 font-display text-[clamp(3rem,7.4vw,7.6rem)] font-semibold leading-[0.9] tracking-[-0.045em]" style={{ animationDelay: "120ms" }}>
          Pay everyone.
          <br />
          <span className="text-mint">
            Never the{" "}
            <span className="relative inline-block">
              wrong
              <RingMark delay={1300} />
            </span>{" "}
            person.
          </span>
        </h1>

        <p className="fade-up mt-7 max-w-2xl text-lg leading-relaxed text-cream/75 sm:text-xl" style={{ animationDelay: "240ms" }}>
          Bursar reads your supplier invoices, catches the fakes and the overcharges, and pays your suppliers and staff once a week, after one OK from you. It can never spend past the limits you set.
        </p>

        <div className="fade-up mt-9 flex flex-wrap justify-center gap-3" style={{ animationDelay: "360ms" }}>
          <Link href="/this-week" className="rounded-full bg-mint px-7 py-3.5 font-medium text-night shadow-[0_0_40px_-8px_rgba(79,209,160,0.8)] transition-colors hover:bg-[#7ee3bd]">
            Try it with a sample restaurant
          </Link>
          <a href="#how" className="rounded-full border border-cream/25 px-7 py-3.5 font-medium text-cream transition-colors hover:border-cream/60">
            Watch a week play out ↓
          </a>
        </div>
      </div>

      <Seal id="seal-hero" className="pointer-events-none absolute right-[4vw] top-[16vh] hidden h-44 w-44 text-cream/70 xl:block" />

      {/* A week's ruler: Monday is today, Friday is payday. */}
      <div aria-hidden className="absolute inset-x-5 bottom-6 z-10 lg:inset-x-12">
        <p className="eyebrow mb-4 text-center text-cream/80">Scroll to see a week</p>
        <div className="relative h-5 bg-[repeating-linear-gradient(to_right,rgb(251_246_234/0.28)_0_1px,transparent_1px_10px)] [mask:linear-gradient(to_bottom,transparent_45%,#000_45%)]">
          <span className="absolute -top-2 bottom-0 left-0 w-[2px] animate-pulse bg-mint shadow-[0_0_10px_rgba(79,209,160,0.9)]" />
        </div>
        <div className="eyebrow mt-1.5 flex justify-between text-[0.6rem] text-cream/40">
          <span className="text-cream">Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span className="text-mint">Fri · payday</span>
        </div>
      </div>
    </section>
  );
}
