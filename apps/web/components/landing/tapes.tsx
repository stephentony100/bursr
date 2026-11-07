// Two strips of ledger tape crossing between sections, printing this week's
// outcomes. The text is doubled so the scroll loops without a seam.

const PAID = [
  "✓ Paid Bisi Adeyemi $220.00 → Base",
  "✓ Paid Mama Put Farms $118.00 → NEAR",
  "✓ Paid Amaka Eze $120.00 → Solana",
  "✓ Paid Ikeja Gas & Charcoal $90.00 → Base",
  "✓ Paid Tunde Okafor $110.00 → Tron",
];
const STOPPED = [
  "✕ Blocked Ek0 Fresh Foods: look-alike name",
  "‖ Held #MPF-0412: sent twice",
  "✕ Blocked Eko Fresh Foods: new bank details",
  "‖ Held tomatoes at $23.40, agreed $18.00",
];

function Tape({ items, className, reverse = false }: { items: string[]; className: string; reverse?: boolean }) {
  const row = [...items, ...items, ...items];
  return (
    <div className={`absolute inset-x-[-5%] overflow-hidden py-3 ${className}`}>
      <div className={`flex w-max ${reverse ? "marquee-reverse" : "marquee"}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {row.map((t, i) => (
              <span key={i} className="eyebrow whitespace-nowrap px-6 text-[0.8rem] font-semibold">
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Tapes() {
  return (
    <div aria-label="This week's outcomes" className="relative h-44 overflow-hidden bg-[linear-gradient(to_bottom,var(--color-night)_50%,var(--color-cream)_50%)]">
      <Tape items={STOPPED} reverse className="top-[48px] rotate-[2.5deg] bg-stamp text-cream" />
      <Tape items={PAID} className="top-[56px] -rotate-[2.5deg] bg-mint text-night shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]" />
    </div>
  );
}
