"use client";

import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { catches } from "./catches";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

// "What Bursr checks" as a pinned accordion, the way New Engen builds its
// services list: a tall section with a sticky full-screen panel; as you scroll,
// one full-width row opens (text, tags, an example on a dark card) and the row
// before it closes and dims. GSAP timeline scrubbed by ScrollTrigger.

const TAGS: string[][] = [
  ["Name match", "Spelling tricks", "Fraud stop"],
  ["Same number", "Same amount", "14-day window"],
  ["Payout on record", "48-hour hold", "Owner-only change"],
  ["Agreed prices", "5% tolerance", "Line by line"],
];

export function ChecksAccordion({ usualAddress, newAddress }: { usualAddress: string; newAddress: string }) {
  const root = useRef<HTMLElement>(null);
  const list = catches(usualAddress, newAddress);

  useGSAP(
    () => {
      const bodies = gsap.utils.toArray<HTMLElement>(".js-acc-body", root.current);
      const titles = gsap.utils.toArray<HTMLElement>(".js-acc-title", root.current);
      gsap.set(bodies, { height: 0 });
      gsap.set(bodies[0], { height: "auto" });
      gsap.set(titles.slice(1), { opacity: 0.45 });
      if (prefersReducedMotion()) {
        gsap.set(bodies, { height: "auto" });
        gsap.set(titles, { opacity: 1 });
        return;
      }
      const tl = gsap.timeline({
        defaults: { duration: 1, ease: "power2.inOut" },
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.6 },
      });
      for (let i = 1; i < bodies.length; i++) {
        tl.to(bodies[i - 1], { height: 0 }, i)
          .to(titles[i - 1], { opacity: 0.45 }, i)
          .to(bodies[i], { height: "auto" }, i)
          .to(titles[i], { opacity: 1 }, i);
      }
      tl.to({}, { duration: 0.6 });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="checks" aria-label="What Bursr checks" className="relative h-[400vh] bg-night text-card">
      <div className="sticky top-0 flex h-[100dvh] flex-col overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-5 pb-6 pt-16 sm:pt-20">
          <h2 className="display max-w-3xl text-4xl leading-[0.98] sm:text-5xl">Four ways bills eat your profit. Bursr checks for all of them.</h2>
        </div>
        <ul className="border-t border-card/15">
          {list.map((c, i) => (
            <li key={c.title} className="border-b border-card/15">
              <div className="mx-auto w-full max-w-7xl px-5">
                <h3 className="js-acc-title py-5 text-2xl font-bold sm:text-3xl">{c.title}</h3>
                <div className="js-acc-body overflow-hidden">
                  <div className="grid gap-8 pb-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-start">
                    <div>
                      <p className="max-w-xl text-lg leading-relaxed text-card/80">{c.line}</p>
                      <ul className="mt-5 flex flex-wrap gap-2">
                        {TAGS[i].map((t) => (
                          <li key={t} className="rounded-full border border-card/35 px-3 py-1 text-xs font-medium text-card/90">
                            {t}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-6">
                        <Badge tone={c.tone}>{c.outcome}</Badge>
                      </div>
                    </div>
                    <div className="hidden rounded-xl border border-card/10 bg-night-2 p-5 sm:block">{c.show}</div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
