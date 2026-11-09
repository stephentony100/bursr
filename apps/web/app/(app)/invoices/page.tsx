import { shortenAddresses } from "@/lib/address";
import Link from "next/link";
import { connection } from "next/server";
import { loadSampleInvoicesAction, uploadInvoiceAction, verifyReaderAction } from "@/app/actions";
import { VerifiedPanel } from "@/components/verified-panel";
import { DEFAULT_READER_MODEL } from "@/lib/reader";
import { ActionForm } from "@/components/forms";
import type { InvoiceStatus } from "@/lib/checks";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { listInvoices } from "@/lib/invoices";
import { formatUsd } from "@/lib/money";
import { getBusiness } from "@/lib/store";

const STATUS: Record<InvoiceStatus, { label: string; tone: string }> = {
  ready: { label: "Ready to pay", tone: "bg-ledger-soft text-ledger" },
  pass: { label: "Ready to pay", tone: "bg-ledger-soft text-ledger" },
  flag: { label: "Ready, but read the note", tone: "bg-hold-soft text-hold" },
  defer: { label: "Moves to next week", tone: "bg-paper-2 text-muted" },
  hold: { label: "On hold: please check", tone: "bg-hold-soft text-hold" },
  block: { label: "Blocked: don't pay", tone: "bg-refuse-soft text-refuse" },
  needs_owner: { label: "Needs your eyes", tone: "bg-hold-soft text-hold" },
};

export default async function InvoicesPage() {
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());
  if (!business) {
    return (
      <p className="text-muted">
        Set up the business first on the{" "}
        <Link href="/this-week" className="text-indigo underline">
          This week
        </Link>{" "}
        page.
      </p>
    );
  }
  const invoices = await listInvoices(db());
  const problems = invoices.filter((i) => !["ready", "flag"].includes(i.status)).length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="display text-4xl">Invoices</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Before a single payment goes out, Bursar checks every invoice for the tricks that cost small businesses money: fake suppliers
          with look-alike names, &ldquo;our bank details have changed&rdquo; messages, the same bill sent twice, prices above what you
          agreed, and sums that don&apos;t add up.
        </p>
        <p className="mt-2 text-sm">
          {invoices.length} invoices · <span className="text-ledger">{invoices.length - problems} ready</span> ·{" "}
          <span className={problems ? "text-refuse" : "text-muted"}>{problems} need attention</span>
        </p>
      </div>

      <VerifiedPanel action={verifyReaderAction} model={readEnv().NEAR_AI_MODEL ?? DEFAULT_READER_MODEL} />

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold [font-stretch:110%]">Add an invoice</h2>
        <p className="mt-1 text-sm text-muted">Got a bill by WhatsApp, email or on paper? Add it here and Bursar checks it in seconds.</p>
        <ActionForm action={uploadInvoiceAction} submit="Check this invoice" className="mt-4 space-y-4">
          <label className="block text-sm font-medium">
            A photo or screenshot of the invoice
            <input type="file" name="file" accept="image/png,image/jpeg,image/webp,text/plain" className="mt-1 block text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Or paste the text of the message
            <textarea name="pasted" rows={3} className="num mt-1 block w-full rounded-md border border-line bg-card px-3 py-2 text-sm" />
          </label>
          <p className="text-sm text-muted">
            {dryRun
              ? "In the demo, Bursar already knows the six sample invoices. Reading your own invoices needs Bursar's AI reader switched on."
              : "Read by Bursar's AI inside a sealed, verifiable computer that keeps your invoice private."}
          </p>
        </ActionForm>
        {dryRun && (
          <div className="mt-6 border-t border-line pt-4">
            <ActionForm action={loadSampleInvoicesAction} submit="Reload the sample invoices" tone="quiet" />
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_11rem_8rem_12rem] gap-4 border-b border-line bg-paper-2/60 px-5 py-2.5 text-xs font-semibold text-muted md:grid">
          <span>Supplier</span>
          <span>Received</span>
          <span className="text-right">Amount</span>
          <span>Status</span>
        </div>
        <ul className="divide-y divide-line">
          {invoices.length === 0 && <li className="px-5 py-6 text-sm text-muted">No invoices yet.</li>}
          {invoices.map((inv) => {
            const s = STATUS[inv.status];
            const issues = inv.results.filter((r) => r.status !== "pass");
            return (
              <li key={inv.id} className="px-5 py-4 [overflow-wrap:anywhere] hover:bg-paper/50">
                <div className="grid gap-x-4 gap-y-1 md:grid-cols-[minmax(0,1fr)_11rem_8rem_12rem] md:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {inv.supplierName || inv.fileName}
                      {inv.invoiceNumber && <span className="font-normal text-muted"> · #{inv.invoiceNumber}</span>}
                    </p>
                    <a href={`/api/invoices/${inv.id}/file`} target="_blank" rel="noreferrer" className="text-sm text-indigo underline">
                      view invoice
                    </a>
                  </div>
                  <p className="text-sm tabular-nums text-muted">
                    {inv.receivedAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="num font-semibold md:text-right">{inv.totalUsd > 0n ? formatUsd(inv.totalUsd) : "Not read"}</p>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                    {s.label}
                  </span>
                </div>
                {(issues.length > 0 || inv.needsOwner) && (
                  <ul className="mt-3 space-y-1 border-l-2 border-line pl-3 text-sm">
                    {inv.needsOwner && <li className="text-hold">{shortenAddresses(inv.needsOwner)}</li>}
                    {issues.map((r) => (
                      <li key={r.check} className={r.status === "block" ? "text-refuse" : r.status === "flag" ? "text-muted" : "text-hold"}>
                        {shortenAddresses(r.reason)}
                      </li>
                    ))}
                  </ul>
                )}
                {inv.extracted && inv.extracted.lines.length > 0 && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted">What Bursar read from it</summary>
                    <table className="mt-2 w-full max-w-xl text-left text-xs">
                      <thead className="text-muted">
                        <tr>
                          <th className="py-1 pr-3 font-medium">Item</th>
                          <th className="py-1 pr-3 text-right font-medium">Qty</th>
                          <th className="py-1 pr-3 text-right font-medium">Unit price</th>
                          <th className="py-1 text-right font-medium">Line total</th>
                        </tr>
                      </thead>
                      <tbody className="num">
                        {inv.extracted.lines.map((l, i) => (
                          <tr key={i} className="border-t border-line">
                            <td className="py-1 pr-3 font-sans">{l.description}</td>
                            <td className="py-1 pr-3 text-right">{l.quantity}</td>
                            <td className="py-1 pr-3 text-right">{l.unitPrice}</td>
                            <td className="py-1 text-right">{l.lineTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs text-muted">Read by: {inv.readBy}</p>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
