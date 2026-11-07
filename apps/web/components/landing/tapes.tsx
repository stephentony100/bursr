// The clearing tape: one ink band printing this week's outcomes, like the
// tally roll from a bank's clearing machine. Text is doubled so it loops.

const ITEMS = [
  ["Paid", "Bisi Adeyemi", "$220.00 to Base"],
  ["Void", "Ek0 Fresh Foods", "look-alike name"],
  ["Paid", "Mama Put Farms Ltd", "$118.00 to NEAR"],
  ["Hold", "Invoice MPF-0412", "sent twice"],
  ["Paid", "Amaka Eze", "$120.00 to Solana"],
  ["Void", "Eko Fresh Foods", "new bank details"],
  ["Paid", "Ikeja Gas & Charcoal", "$90.00 to Base"],
  ["Hold", "Tomatoes at $23.40", "agreed $18.00"],
  ["Paid", "Tunde Okafor", "$110.00 to Tron"],
];

export function ClearingTape() {
  return (
    <div aria-label="This week's outcomes" className="overflow-hidden border-y border-ink bg-night py-3.5 text-card">
      <div className="marquee flex w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0" aria-hidden={copy === 1}>
            {ITEMS.map(([verb, who, what], i) => (
              <span key={i} className="flex items-baseline gap-2 whitespace-nowrap px-7 text-sm">
                <span className={`field-label ${verb === "Paid" ? "text-card" : "text-card/60 line-through decoration-1"}`}>{verb}</span>
                <span className="font-semibold">{who}</span>
                <span className="text-card/70">{what}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
