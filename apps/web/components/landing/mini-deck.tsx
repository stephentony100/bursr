"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TINTS, VERDICT } from "./paper";
import { WEEK_INVOICES } from "./week-data";

// A small deck of this week's invoices that follows you down the page after
// the week scene. Hover fans it out; it opens the demo.

export function MiniDeck() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Show after the week scene (it has its own ruler there) and hide by the footer.
    const on = () => {
      const how = document.getElementById("how");
      const after = how ? how.offsetTop + how.offsetHeight - window.innerHeight : window.innerHeight;
      const nearEnd = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 260;
      setShow(window.scrollY > after && !nearEnd);
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const cards = [WEEK_INVOICES[2], WEEK_INVOICES[5], WEEK_INVOICES[0]];
  return (
    <Link
      href="/this-week"
      aria-label="Open the demo with the sample restaurant"
      className={`group fixed bottom-5 right-5 z-50 hidden h-28 w-36 transition-all duration-500 sm:block ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"}`}
    >
      {cards.map((inv, i) => {
        const v = VERDICT[inv.verdict];
        return (
          <span
            key={i}
            className="absolute bottom-6 left-8 h-[84px] w-16 origin-bottom rounded-md border border-black/10 p-1.5 shadow-lg transition-transform duration-300 [transform:rotate(var(--rest))] group-hover:[transform:rotate(var(--fan))_translateY(-6px)]"
            style={{
              background: `linear-gradient(165deg, ${TINTS[[2, 5, 0][i]]}, #fffdf6 80%)`,
              ["--rest" as string]: `${(i - 1) * 7}deg`,
              ["--fan" as string]: `${(i - 1) * 24}deg`,
            }}
          >
            <span className="block h-1 w-8 rounded bg-black/20" />
            <span className="mt-1 block h-1 w-6 rounded bg-black/10" />
            <span className="mt-3 block rounded-sm border text-center font-mono text-[0.4rem] font-semibold uppercase leading-[1.4]" style={{ color: v.color, borderColor: v.color }}>
              {v.word}
            </span>
          </span>
        );
      })}
      <span className="eyebrow absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-night px-3 py-1.5 text-[0.6rem] text-cream shadow-lg ring-1 ring-cream/20 transition-colors group-hover:bg-mint group-hover:text-night">
        Try the demo →
      </span>
    </Link>
  );
}
