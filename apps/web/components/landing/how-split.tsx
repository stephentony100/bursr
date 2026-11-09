"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

// "How a week works" as a pinned split screen, the way Hear.ai builds its
// 500vh section: a sticky full-height grid; the left panel's colour and line
// rings change with scroll (GSAP timeline scrubbed by ScrollTrigger) and the
// right-hand statement swaps with Hear's reveal (blur 16px, y 14, power2.out).

type Ring = { cx: number; cy: number; rx: number; ry: number; rot: number };

const STEPS: { when: string; title: string; body: string; panel: string; ink: string; rings: Ring[] }[] = [
  {
    when: "Monday to Thursday",
    title: "Invoices come in.",
    body: "Snap a photo of each supplier invoice and upload it. Bursar reads it privately: who it's from, what you bought, how much, and where they want the money.",
    panel: "#e1e8de",
    ink: "#16202a",
    rings: [
      { cx: 300, cy: 170, rx: 230, ry: 48, rot: 0 },
      { cx: 300, cy: 250, rx: 230, ry: 48, rot: 0 },
      { cx: 300, cy: 330, rx: 230, ry: 48, rot: 0 },
      { cx: 300, cy: 410, rx: 230, ry: 48, rot: 0 },
    ],
  },
  {
    when: "As they arrive",
    title: "Every one is checked.",
    body: "Is it really your supplier? Have you paid it already? Did their bank details change? Are the prices what you agreed? Anything odd is held, with the reason in one plain sentence.",
    panel: "#f1e3c9",
    ink: "#16202a",
    rings: [
      { cx: 300, cy: 290, rx: 230, ry: 230, rot: 0 },
      { cx: 300, cy: 290, rx: 165, ry: 165, rot: 0 },
      { cx: 300, cy: 290, rx: 100, ry: 100, rot: 0 },
      { cx: 300, cy: 290, rx: 35, ry: 35, rot: 0 },
    ],
  },
  {
    when: "Friday",
    title: "One list. One OK.",
    body: "Staff pay and the clean invoices go on one list, with every fee shown. You read it, then approve everyone at once.",
    panel: "#d5e7e0",
    ink: "#16202a",
    rings: [
      { cx: 300, cy: 290, rx: 240, ry: 70, rot: -30 },
      { cx: 300, cy: 290, rx: 240, ry: 70, rot: -10 },
      { cx: 300, cy: 290, rx: 240, ry: 70, rot: 10 },
      { cx: 300, cy: 290, rx: 240, ry: 70, rot: 30 },
    ],
  },
  {
    when: "Minutes later",
    title: "Everyone is paid.",
    body: "Six payments, $661.29, each in digital dollars on the network the payee chose: NEAR, Base, Tron or Solana. The four problem invoices wait for you, each with its reason.",
    panel: "#16202a",
    ink: "#7fc4b8",
    rings: [
      { cx: 120, cy: 290, rx: 50, ry: 130, rot: 0 },
      { cx: 180, cy: 290, rx: 110, ry: 130, rot: 0 },
      { cx: 250, cy: 290, rx: 180, ry: 130, rot: 0 },
      { cx: 320, cy: 290, rx: 250, ry: 130, rot: 0 },
    ],
  },
];

const ringAttr = (r: Ring) => ({ cx: r.cx, cy: r.cy, rx: r.rx, ry: r.ry, transform: `rotate(${r.rot} ${r.cx} ${r.cy})` });

export function HowSplit() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const panel = root.current!.querySelector<HTMLElement>(".js-panel")!;
      const rings = gsap.utils.toArray<SVGEllipseElement>(".js-ring", root.current);
      const texts = gsap.utils.toArray<HTMLElement>(".js-step", root.current);
      const whens = gsap.utils.toArray<HTMLElement>(".js-when", root.current);
      const bars = gsap.utils.toArray<HTMLElement>(".js-bar", root.current);

      gsap.set(texts.slice(1), { autoAlpha: 0 });
      gsap.set(whens.slice(1), { autoAlpha: 0 });
      gsap.set(bars, { scaleX: 0, transformOrigin: "left center" });
      if (prefersReducedMotion()) {
        gsap.set(bars, { scaleX: 1 });
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom bottom", scrub: true },
      });
      STEPS.forEach((step, i) => {
        tl.to(bars[i], { scaleX: 1, duration: 1 }, i * 1.2);
        if (i === 0) return;
        const at = i * 1.2 - 0.2;
        tl.to(panel, { backgroundColor: step.panel, duration: 0.4 }, at);
        rings.forEach((ring, k) => tl.to(ring, { attr: ringAttr(step.rings[k]), stroke: step.ink, duration: 0.4, ease: "power2.inOut" }, at));
        tl.to(texts[i - 1], { autoAlpha: 0, filter: "blur(16px)", y: -14, duration: 0.2 }, at);
        tl.to(whens[i - 1], { autoAlpha: 0, duration: 0.2 }, at);
        tl.fromTo(texts[i], { autoAlpha: 0, filter: "blur(16px)", y: 14 }, { autoAlpha: 1, filter: "blur(0px)", y: 0, duration: 0.25, ease: "power2.out" }, at + 0.15);
        tl.to(whens[i], { autoAlpha: 1, color: i === STEPS.length - 1 ? "#f8faf5" : "#16202a", duration: 0.2 }, at + 0.15);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="how" aria-label="How a week works" className="relative h-[500vh] bg-paper">
      <ol className="sr-only">
        {STEPS.map((s) => (
          <li key={s.title}>
            {s.when}: {s.title} {s.body}
          </li>
        ))}
      </ol>
      <div aria-hidden className="sticky top-0 grid h-[100dvh] grid-rows-[46%_54%] overflow-hidden md:grid-cols-2 md:grid-rows-1">
        <div className="js-panel relative" style={{ backgroundColor: STEPS[0].panel }}>
          <svg viewBox="0 0 600 580" className="absolute inset-0 m-auto h-[80%] w-[80%]" fill="none">
            {STEPS[0].rings.map((r, k) => (
              <ellipse key={k} className="js-ring" {...ringAttr(r)} stroke={STEPS[0].ink} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="absolute bottom-6 left-6 right-6 sm:bottom-8 sm:left-10">
            {STEPS.map((s) => (
              <p key={s.when} className="js-when field-label absolute bottom-0 left-0 text-ink">
                {s.when}
              </p>
            ))}
          </div>
        </div>
        <div className="relative flex items-center px-6 sm:px-12 lg:px-20">
          <div className="relative w-full max-w-xl">
            <div className="mb-8 grid grid-cols-4 gap-2">
              {STEPS.map((s) => (
                <span key={s.title} className="h-[3px] bg-ink/10">
                  <span className="js-bar block h-full bg-ledger" />
                </span>
              ))}
            </div>
            <div className="relative min-h-[16rem]">
              {STEPS.map((s) => (
                <div key={s.title} className="js-step absolute inset-x-0 top-0">
                  <h2 className="display text-4xl leading-[0.98] sm:text-5xl xl:text-6xl">{s.title}</h2>
                  <p className="mt-5 max-w-lg text-base leading-relaxed text-ink/75 sm:text-lg">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
