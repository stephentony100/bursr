import { ChecksAccordion } from "@/components/landing/checks-accordion";
import { Hero } from "@/components/landing/hero";
import { HowSplit } from "@/components/landing/how-split";
import { LimitsTabs } from "@/components/landing/limits-tabs";
import { NetworkStrip } from "@/components/landing/network-strip";
import { PeopleBand } from "@/components/landing/people-band";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { Statement } from "@/components/landing/statement";
import { Reveal } from "@/components/landing/reveal";
import { Closing, Figures, Pricing, Privacy } from "@/components/landing/sections";
import { demoTronAddress } from "@/lib/demo-addresses";

/** Tells search engines what Bursr is (schema.org SoftwareApplication). */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Bursr",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "An AI agent that pays a small business's staff and suppliers in stablecoins on any network, checks invoices for fraud, and pays inside limits enforced by its account.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "0.5% of each payment run" },
};

export default function Landing() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div aria-hidden className="scroll-progress fixed inset-x-0 top-0 z-[60] h-0.5 bg-ledger" />
      <SmoothScroll />
      <Hero />
      <main id="main">
        <NetworkStrip />
        <Statement />
        <PeopleBand />
        <HowSplit />
        <ChecksAccordion usualAddress={demoTronAddress("eko-fresh-foods")} newAddress={demoTronAddress("eko-new-account")} />

        <section id="limits" aria-labelledby="limits-title" className="border-y border-line bg-card">
          <div className="mx-auto w-full max-w-7xl px-5 py-24">
            <Reveal as="h2" onScroll className="display max-w-3xl text-4xl leading-[1.05] sm:text-5xl">
              <span id="limits-title">The AI does the work. Your wallet keeps the rules.</span>
            </Reveal>
            <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-muted">
              Your limits live in your Bursr wallet, not in the AI, so even a confused or tricked AI can&apos;t go past them.
            </p>
            <div className="mt-12">
              <LimitsTabs />
            </div>
          </div>
        </section>

        <Privacy />
        <Figures />
        <Pricing />
        <Closing />
      </main>
    </>
  );
}
