import { SAMPLE_INVOICES } from "@/lib/sample-invoices";

// The landing page's signature: this week's six invoices fanned out like a
// hand of cards, each stamped with what Bursar decided. Drawn with HTML/CSS
// from the real sample data (lib/sample-invoices.ts).

const STAMPS: Record<string, { word: string; note: string; color: string }> = {
  "01": { word: "Ready", note: "Checks out", color: "#0f6b4f" },
  "02": { word: "Ready", note: "Checks out", color: "#0f6b4f" },
  "03": { word: "Blocked", note: "Look-alike name", color: "#c8322b" },
  "04": { word: "Hold", note: "Sent twice", color: "#a86a12" },
  "05": { word: "Blocked", note: "Bank details changed", color: "#c8322b" },
  "06": { word: "Hold", note: "Tomatoes +30%", color: "#a86a12" },
};

const TINTS = ["#fbf6ea", "#eef6f0", "#fdf0ec", "#fbf3dc", "#fdeeee", "#f3f1fb"];

export function InvoiceDeck() {
  const n = SAMPLE_INVOICES.length;
  return (
    <div className="relative mx-auto h-[330px] w-full max-w-[1000px] sm:h-[400px]" aria-label="This week's six invoices, each checked by Bursar">
      {SAMPLE_INVOICES.map((inv, i) => {
        const offset = i - (n - 1) / 2;
        const stamp = STAMPS[inv.file.slice(0, 2)];
        const p = inv.printed;
        return (
          <div
            key={inv.file}
            className="absolute left-1/2 top-6 origin-bottom"
            style={{
              transform: `translateX(-50%) translateX(calc(${offset} * min(14vw, 128px))) translateY(${Math.abs(offset) * 16}px) rotate(${offset * 8}deg)`,
              zIndex: i,
            }}
          >
            <article
              className="deal w-[150px] rounded-xl border border-black/10 p-3 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:-translate-y-4 sm:w-[200px] sm:p-4"
              style={{ background: TINTS[i], animationDelay: `${120 + i * 90}ms` }}
            >
              <p className="eyebrow text-[0.58rem] text-muted">Invoice #{p.invoiceNumber}</p>
              <p className="mt-1 font-display text-[0.95rem] font-semibold leading-tight text-ink sm:text-lg">{p.supplierName}</p>
              <ul className="num mt-3 space-y-1 text-[0.6rem] text-muted sm:text-[0.7rem]">
                {p.lines.slice(0, 2).map((l) => (
                  <li key={l.description} className="flex justify-between gap-2">
                    <span className="truncate">{l.description}</span>
                    <span>{l.lineTotal}</span>
                  </li>
                ))}
              </ul>
              <p className="num mt-3 flex justify-between border-t border-black/10 pt-2 text-xs font-medium text-ink">
                <span>TOTAL</span>
                <span>${p.total}</span>
              </p>
              <div
                className="stamp-in mt-4 inline-block rounded-md border-2 px-2 py-1"
                style={{ color: stamp.color, borderColor: stamp.color, ["--tilt" as string]: `${-6 + (i % 3) * 4}deg`, animationDelay: `${900 + i * 140}ms` }}
              >
                <span className="eyebrow block text-[0.68rem] font-semibold">{stamp.word}</span>
                <span className="block text-[0.6rem] leading-tight">{stamp.note}</span>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
