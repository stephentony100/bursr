// A ledger ruler for the weekly limit: ticks every $100 up to $2,500,
// with this week's sample list ($661.29) marked and the rest still free.

const LIMIT = 2500;
const SPENT = 661.29;

export function LimitRuler() {
  const ticks = Array.from({ length: LIMIT / 100 + 1 }, (_, i) => i * 100);
  const pct = (SPENT / LIMIT) * 100;
  return (
    <figure className="mt-14" aria-label={`This week: $${SPENT} of a $${LIMIT} weekly limit`}>
      <div className="relative h-16">
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between">
          {ticks.map((t) => (
            <span key={t} className={`w-px ${t % 500 === 0 ? "h-8 bg-cream/60" : "h-4 bg-cream/25"}`} />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 h-1 rounded-full bg-mint" style={{ width: `${pct}%` }} />
        <div className="absolute bottom-0 flex flex-col items-center" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
          <span className="num mb-1 whitespace-nowrap rounded bg-mint px-2 py-0.5 text-xs text-night">This week $661.29</span>
          <span className="h-10 w-0.5 bg-mint" />
        </div>
        <div className="absolute bottom-0 right-0 flex flex-col items-end">
          <span className="num mb-1 whitespace-nowrap rounded bg-stamp px-2 py-0.5 text-xs text-white">Limit $2,500</span>
          <span className="h-10 w-0.5 bg-stamp" />
        </div>
      </div>
      <div className="num mt-2 flex justify-between text-[0.65rem] text-cream/40">
        {ticks.filter((t) => t % 500 === 0).map((t) => (
          <span key={t}>${t.toLocaleString("en-US")}</span>
        ))}
      </div>
      <figcaption className="mt-4 text-sm text-cream/60">
        Anything past the red line is refused by the wallet itself, with the reason shown to you.
      </figcaption>
    </figure>
  );
}
