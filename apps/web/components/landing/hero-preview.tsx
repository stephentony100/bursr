import { Badge } from "@/components/ui/badge";
import { WEEK_INVOICES, WEEK_PAYMENTS, WEEK_TOTAL_CENTS, usd } from "./week-data";

// The home page's first-viewport visual: a static preview of the app's
// Payments screen for the sample restaurant, built from the demo's own data.

const HELD = WEEK_INVOICES.filter((i) => i.verdict !== "ready");

export function HeroPreview() {
  return (
    <figure aria-label="Preview of the Payments screen: six payments ready for one approval, four invoices held with reasons" className="min-w-0 overflow-hidden rounded-xl border border-line bg-card shadow-[0_24px_48px_-24px_rgb(16_24_40/0.25)]">
      <div className="flex items-center gap-1.5 border-b border-line bg-paper px-4 py-2.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-3 text-xs text-muted">Bukka Corner Restaurant / Payments</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-4 pt-5">
        <div>
          <p className="text-xs font-medium text-muted">This week&apos;s payments · ready for your OK</p>
          <p className="num mt-1 text-3xl font-semibold tracking-tight">{usd(WEEK_TOTAL_CENTS)}</p>
        </div>
        <span className="rounded-lg bg-ledger px-3 py-2 text-sm font-semibold text-white" aria-hidden>
          Approve and pay everyone
        </span>
      </div>

      <table className="w-full text-sm">
        <thead className="whitespace-nowrap [overflow-wrap:normal] border-y border-line bg-paper text-left text-xs text-muted">
          <tr>
            <th scope="col" className="px-5 py-2 font-medium">Pay</th>
            <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Paid in</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {WEEK_PAYMENTS.map((p) => (
            <tr key={p.who}>
              <td className="px-5 py-2.5">
                <p className="font-medium">{p.who}</p>
                <p className="text-xs text-muted">{p.what}</p>
              </td>
              <td className="hidden px-3 py-2.5 text-muted sm:table-cell">
                {p.token} on {p.network}
              </td>
              <td className="num px-5 py-2.5 text-right">{usd(p.cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-line bg-paper px-5 py-4">
        <p className="text-xs font-medium text-muted">Not paid this week, and why</p>
        <ul className="mt-2 space-y-1.5">
          {HELD.map((h, i) => (
            <li key={`${h.number}-${i}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">
                {h.supplier} <span className="text-muted">· #{h.number}</span>
              </span>
              <Badge tone={h.verdict === "block" ? "block" : "hold"}>{h.note}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
