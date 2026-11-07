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
  flag: { label: "Ready, with a warning", tone: "bg-hold-soft text-hold" },
  defer: { label: "Next week", tone: "bg-paper text-muted" },
  hold: { label: "On hold: check it", tone: "bg-hold-soft text-hold" },
  block: { label: "Blocked", tone: "bg-refuse-soft text-refuse" },
  needs_owner: { label: "Needs you", tone: "bg-hold-soft text-hold" },
};

export default async function InvoicesPage() {
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());
  if (!business) {
    return (
      <p className="text-muted">
        Set up the business first on the{" "}
        <Link href="/" className="text-indigo underline">
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
        <h1 className="font-display text-3xl font-semibold">Invoices</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Bursar reads each invoice and checks it before anything is paid: is the supplier on your list, is the name a look-alike,
          did the payment details change, is it a duplicate, are prices above what you agreed, do the sums add up.
        </p>
        <p className="mt-2 text-sm">
          {invoices.length} invoices · <span className="text-ledger">{invoices.length - problems} ready</span> ·{" "}
          <span className={problems ? "text-refuse" : "text-muted"}>{problems} need attention</span>
        </p>
      </div>

      <VerifiedPanel action={verifyReaderAction} model={readEnv().NEAR_AI_MODEL ?? DEFAULT_READER_MODEL} />

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Add an invoice</h2>
        <ActionForm action={uploadInvoiceAction} submit="Read and check" className="mt-4 space-y-4">
          <label className="block text-sm font-medium">
            Photo of the invoice
            <input type="file" name="file" accept="image/png,image/jpeg,image/webp,text/plain" className="mt-1 block text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Or paste its text
            <textarea name="pasted" rows={3} className="num mt-1 block w-full rounded-md border border-line bg-card px-3 py-2 text-sm" />
          </label>
          <p className="text-sm text-muted">
            {dryRun
              ? "Practice mode: the six sample invoices are recognised without AI. Any other invoice needs NEAR AI Cloud (NEAR_AI_API_KEY with credits)."
              : "Read privately by NEAR AI Cloud, inside a secure enclave (TEE)."}
          </p>
        </ActionForm>
        {dryRun && (
          <div className="mt-6 border-t border-line pt-4">
            <ActionForm action={loadSampleInvoicesAction} submit="Read the six sample invoices again" tone="quiet" />
          </div>
        )}
      </section>

      <ul className="space-y-4">
        {invoices.length === 0 && <li className="text-sm text-muted">No invoices yet.</li>}
        {invoices.map((inv) => {
          const s = STATUS[inv.status];
          const issues = inv.results.filter((r) => r.status !== "pass");
          return (
            <li key={inv.id} className="rounded-xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                <div className="min-w-56 flex-1">
                  <p className="font-medium">
                    {inv.supplierName || inv.fileName}
                    {inv.invoiceNumber && <span className="text-muted"> · #{inv.invoiceNumber}</span>}
                  </p>
                  <p className="text-sm text-muted">
                    Received {inv.receivedAt.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} ·{" "}
                    <a href={`/api/invoices/${inv.id}/file`} target="_blank" rel="noreferrer" className="text-indigo underline">
                      see the invoice
                    </a>
                  </p>
                </div>
                <p className="num font-display text-xl font-semibold">{inv.totalUsd > 0n ? formatUsd(inv.totalUsd) : "—"}</p>
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${s.tone}`}>{s.label}</span>
              </div>
              {(issues.length > 0 || inv.needsOwner) && (
                <ul className="mt-3 space-y-1 text-sm">
                  {inv.needsOwner && <li className="text-hold">{inv.needsOwner}</li>}
                  {issues.map((r) => (
                    <li key={r.check} className={r.status === "block" ? "text-refuse" : r.status === "flag" ? "text-muted" : "text-hold"}>
                      {r.reason}
                    </li>
                  ))}
                </ul>
              )}
              {inv.extracted && inv.extracted.lines.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted">What Bursar read</summary>
                  <table className="num mt-2 w-full max-w-xl text-left text-xs">
                    <tbody>
                      {inv.extracted.lines.map((l, i) => (
                        <tr key={i} className="border-b border-line">
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
    </div>
  );
}
