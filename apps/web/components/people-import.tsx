"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { importPeopleAction, previewImportAction, type ImportPreview } from "@/app/actions";

// Adding many people at once: choose a spreadsheet (CSV), see every row
// checked, then add everyone whose row is fine in one go.

export function PeopleImport({ template, live }: { template: string; live: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);

  const form = () => {
    const f = new FormData();
    if (file) f.set("file", file);
    return f;
  };
  const good = preview?.ok ? preview.rows.filter((r) => r.input) : [];
  const bad = preview?.ok ? preview.rows.filter((r) => !r.input) : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Put one person per row in a spreadsheet (Excel, Google Sheets, Numbers) with these headings, then save or download it as CSV.{" "}
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="bursar-people.csv" className="inline-flex items-center gap-1 text-indigo underline">
          <DownloadSimple size={14} aria-hidden /> Download the template
        </a>
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setDone(null);
          setPreview(await previewImportAction(form()));
          setBusy(false);
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setDone(null);
          }}
          className="max-w-full text-sm"
        />
        <button disabled={!file || busy} className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-60">
          {busy && !preview ? "Checking…" : "Check the file"}
        </button>
      </form>

      {preview && !preview.ok && (
        <p role="alert" className="text-sm text-refuse">
          {preview.message}
        </p>
      )}

      {preview?.ok && !done?.ok && (
        <div className="rounded-lg border border-line">
          <p className="border-b border-line bg-paper px-4 py-2 text-sm">
            <span className="font-semibold text-ledger">{good.length} ready to add</span>
            {bad.length > 0 && <span className="text-refuse"> · {bad.length} need fixing (they won&apos;t be added)</span>}
          </p>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto text-sm">
            {preview.rows.map((r) => (
              <li key={r.line} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2">
                <span>
                  <span className="text-muted">Row {r.line} · </span>
                  <span className="font-medium">{r.name || "(no name)"}</span>
                </span>
                {r.problem ? <span className="text-refuse">{r.problem}</span> : <span className="text-muted">{r.summary}</span>}
              </li>
            ))}
          </ul>
          {good.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await importPeopleAction(form());
                  setDone(r);
                  setBusy(false);
                  if (r.ok) router.refresh();
                }}
                className="rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-white hover:bg-indigo disabled:opacity-60"
              >
                {busy ? "Adding…" : `Add ${good.length} ${good.length === 1 ? "person" : "people"}`}
              </button>
              <span className="text-sm text-muted">
                {live ? "Then one confirmation with your wallet covers everyone." : "Each person's first payment will ask for your OK."}
              </span>
            </div>
          )}
        </div>
      )}

      {done && (
        <p role={done.ok ? "status" : "alert"} className={`text-sm ${done.ok ? "text-ledger" : "text-refuse"}`}>
          {done.message}
        </p>
      )}
    </div>
  );
}
