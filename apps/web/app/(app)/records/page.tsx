import { connection } from "next/server";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/session";
import { formatUsd } from "@/lib/money";
import { refreshPayments } from "@/lib/pay";
import { statementLines } from "@/lib/statement";
import { monthFacts, plainSummary } from "@/lib/summary";
import { aiSummaryAction } from "@/app/actions";
import { AiSummaryButton } from "@/components/ai-summary";

export default async function StatementPage() {
  await guardPage();
  await connection();
  await refreshPayments(db());
  const lines = await statementLines(db());
  const total = lines.filter((l) => l.status !== "Not paid").reduce((a, l) => a + l.amountUsd, 0n);
  const facts = await monthFacts(db());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl">Records</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every payment, who it went to, what it was for and when you approved it. Your payments stay private, so this page is your
            proof. Your accountant will love the spreadsheet.
          </p>
        </div>
        <a href="/api/records.csv" className="rounded-md bg-ledger px-4 py-2 text-sm font-medium text-card hover:bg-indigo">
          Download for my accountant (CSV)
        </a>
      </div>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold">{facts.month} in plain words</h2>
        <p className="mt-2 max-w-3xl">{plainSummary(facts)}</p>
        <AiSummaryButton action={aiSummaryAction} />
      </section>

      {lines.length === 0 ? (
        <p className="text-muted">No payments yet. Approve this week&apos;s payments on the Payments page and they&apos;ll appear here.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card" tabIndex={0} role="region" aria-label="Payments this month">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="whitespace-nowrap [overflow-wrap:normal] border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Paid to</th>
                <th className="px-4 py-3 font-medium">For</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Where it went</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{l.date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-3">{l.payee}</td>
                  <td className="px-4 py-3">{l.forWhat}</td>
                  <td className="num px-4 py-3 text-right">{formatUsd(l.amountUsd)}</td>
                  <td className="px-4 py-3">
                    <span className="num text-xs break-all">{l.receivedAs}</span>
                    {l.references && <p className="num mt-1 text-xs text-muted">proof: {l.references}</p>}
                  </td>
                  <td className={`px-4 py-3 ${l.status === "Not paid" ? "text-refuse" : l.status === "Paid" ? "text-ledger" : ""}`}>
                    {l.status}
                    {l.note && <p className="text-xs">{l.note}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{l.approval}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-medium">
                  Total paid
                </td>
                <td className="num px-4 py-3 text-right font-medium">{formatUsd(total)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
