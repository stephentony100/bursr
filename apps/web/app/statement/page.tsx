import { connection } from "next/server";
import { db } from "@/lib/db";
import { formatUsd } from "@/lib/money";
import { refreshPayments } from "@/lib/pay";
import { statementLines } from "@/lib/statement";
import { monthFacts, plainSummary } from "@/lib/summary";
import { aiSummaryAction } from "@/app/actions";
import { AiSummaryButton } from "@/components/ai-summary";

export default async function StatementPage() {
  await connection();
  await refreshPayments(db());
  const lines = await statementLines(db());
  const total = lines.filter((l) => l.status !== "Failed").reduce((a, l) => a + l.amountUsd, 0n);
  const facts = await monthFacts(db());

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Statement</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every payment Bursar sent or tried to send, who approved it, and the account&apos;s references. Payments settle privately, so this
            is your record.
          </p>
        </div>
        <a href="/api/statement.csv" className="rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white hover:bg-ledger/90">
          Download CSV
        </a>
      </div>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">{facts.month} in plain words</h2>
        <p className="mt-2 max-w-3xl">{plainSummary(facts)}</p>
        <AiSummaryButton action={aiSummaryAction} />
      </section>

      {lines.length === 0 ? (
        <p className="text-muted">No payments yet. Approve a plan on the Plan page.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Payee</th>
                <th className="px-4 py-3 font-medium">For</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Received as</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Approval</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="num px-4 py-3 whitespace-nowrap">{l.date.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-3">{l.payee}</td>
                  <td className="px-4 py-3">{l.forWhat}</td>
                  <td className="num px-4 py-3 text-right">{formatUsd(l.amountUsd)}</td>
                  <td className="px-4 py-3">
                    <span className="num text-xs break-all">{l.receivedAs}</span>
                    {l.references && <p className="num mt-1 text-xs text-muted">ref {l.references}</p>}
                  </td>
                  <td className={`px-4 py-3 ${l.status === "Failed" ? "text-refuse" : l.status === "Delivered" ? "text-ledger" : ""}`}>
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
