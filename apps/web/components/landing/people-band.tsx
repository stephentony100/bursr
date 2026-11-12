"use client";

import { CheckCircle, Receipt, ShieldCheck, Lightning } from "@phosphor-icons/react";
import Image from "next/image";
import { useRef } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "./gsap";

// The people a business pays, in their own places, each with the moment
// Bursr touched their week. Photos: Pexels and Unsplash (free licences,
// credited in the README). Photos drift slower than the page as it scrolls.

type Tile = {
  src: string;
  alt: string;
  focus: string;
  className: string;
  card: { icon: "paid" | "checked" | "once" | "safe"; title: string; line: string };
};

const TILES: Tile[] = [
  {
    src: "/photos/chef-abuja.jpg",
    alt: "A smiling restaurant owner in a blue kaftan beside his buffet counter",
    focus: "55% 30%",
    className: "md:col-span-2 md:row-span-2 min-h-[420px]",
    card: { icon: "paid", title: "Weekly pay · $220.00", line: "Paid Friday, 9:02 · USDC on Base" },
  },
  {
    src: "/photos/tomatoes-ibadan.jpg",
    alt: "A tomato and pepper seller arranging produce at Bodija Market, Ibadan",
    focus: "50% 60%",
    className: "min-h-[300px]",
    card: { icon: "checked", title: "Invoice #MPF-0412", line: "Prices match what you agreed" },
  },
  {
    src: "/photos/jollof-lagos.jpg",
    alt: "A cook in a green apron serving from a grill at a Lagos street stall",
    focus: "50% 40%",
    className: "min-h-[300px]",
    card: { icon: "once", title: "Paid once · $40.00", line: "Gas refill, sent in 30 seconds" },
  },
  {
    src: "/photos/shop-abuja.jpg",
    alt: "A shopkeeper behind the counter of a colourful grocery store in Abuja",
    focus: "50% 45%",
    className: "min-h-[300px]",
    card: { icon: "safe", title: "New bank details? Held.", line: "Changed details wait 48 hours" },
  },
  {
    src: "/photos/vendor-phone.jpg",
    alt: "A fruit seller smiling, holding her phone at her stall",
    focus: "68% 35%",
    className: "min-h-[300px]",
    card: { icon: "paid", title: "+$120.00 received", line: "USDC on Solana" },
  },
];

const ICONS = {
  paid: { Icon: CheckCircle, tone: "text-ok bg-ok-soft" },
  checked: { Icon: Receipt, tone: "text-ledger bg-ledger-soft" },
  once: { Icon: Lightning, tone: "text-ledger bg-ledger-soft" },
  safe: { Icon: ShieldCheck, tone: "text-refuse bg-refuse-soft" },
};

export function PeopleBand() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.utils.toArray<HTMLElement>("[data-drift]", root.current).forEach((img) => {
        gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
      });
      gsap.fromTo(
        gsap.utils.toArray("[data-tile]", root.current),
        { clipPath: "inset(18% 0% 0% 0% round 28px)", autoAlpha: 0 },
        { clipPath: "inset(0% 0% 0% 0% round 28px)", autoAlpha: 1, duration: 1.1, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: root.current, start: "top 75%", once: true } },
      );
      gsap.from(gsap.utils.toArray("[data-tile-card]", root.current), {
        delay: 0.5,
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        ease: "back.out(1.5)",
        stagger: 0.12,
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
      });
      return () => ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="people-title" className="bg-paper">
      <div className="mx-auto w-full max-w-7xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-ledger">Who Bursr pays</p>
          <h2 id="people-title" className="display mt-3 text-4xl leading-[1.05] sm:text-5xl">
            The people who keep your business open.
          </h2>
          <p className="mt-4 text-lg text-muted">Your chef, your tomato seller, the man who brings the gas. Paid on time, in full, on the network they use.</p>
        </div>
        <div className="mt-12 grid auto-rows-[minmax(0,1fr)] gap-4 md:grid-cols-4">
          {TILES.map((t) => {
            const { Icon, tone } = ICONS[t.card.icon];
            return (
              <figure key={t.src} data-tile className={`relative overflow-hidden rounded-[28px] bg-ink ${t.className}`}>
                <Image data-drift src={t.src} alt={t.alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="scale-[1.14] object-cover" style={{ objectPosition: t.focus }} />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                <figcaption data-tile-card className="absolute bottom-4 left-4 right-4 flex max-w-[320px] items-center gap-3 rounded-2xl bg-card/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone}`}>
                    <Icon size={20} weight="fill" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{t.card.title}</span>
                    <span className="block truncate text-xs text-muted">{t.card.line}</span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
