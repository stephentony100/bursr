"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

// The problem, lit word by word as you read (Onboard's "Why" pattern):
// words start faint and turn solid as the block scrolls through the screen.
export function Statement() {
  const ref = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      const split = SplitText.create(ref.current, { type: "words" });
      gsap.fromTo(
        split.words,
        { opacity: 0.16 },
        { opacity: 1, stagger: 0.08, ease: "none", scrollTrigger: { trigger: ref.current, start: "top 78%", end: "bottom 42%", scrub: true } },
      );
      return () => split.revert();
    },
    { scope: ref },
  );
  return (
    <section aria-label="Why Bursr" className="bg-card">
      <div className="mx-auto w-full max-w-5xl px-5 py-28 sm:py-36">
        <p ref={ref} className="display text-[clamp(1.9rem,4vw,3.4rem)] font-extrabold leading-[1.12] tracking-[-0.035em]">
          A fake invoice from a name that looks right. The same bill sent twice. A text that says <span className="text-refuse">&ldquo;our account has changed&rdquo;</span>. These cost small
          businesses real money. <span className="text-ledger">Bursr catches them before a single naira, dollar or cent moves.</span>
        </p>
      </div>
    </section>
  );
}
