import Link from "next/link";
import { AppNav, PageName } from "@/components/app-nav";
import { HeaderWallet } from "@/components/header-wallet";
import { Logo } from "@/components/logo";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { getOwner } from "@/lib/session";
import { getBusiness } from "@/lib/store";

function ModeBadge({ dryRun }: { dryRun: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${dryRun ? "bg-hold-soft text-hold" : "bg-refuse-soft text-refuse"}`}
      title={dryRun ? "You're exploring with a sample restaurant and practice money. Nothing real is paid." : "Real money. Payments go out for real."}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dryRun ? "bg-hold" : "bg-refuse"}`} />
      {dryRun ? "Demo · practice money" : "Live · real money"}
    </span>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  await connection();
  const owner = dryRun ? null : await getOwner();
  const business = await getBusiness(db());
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* Sidebar (large screens) */}
      <div className="hidden bg-night lg:block">
      <aside className="sticky top-0 flex h-[100dvh] flex-col px-3 py-5 text-card">
        <Link href="/this-week" aria-label="Bursar, this week" className="px-3">
          <Logo tone="light" />
        </Link>
        <p className="mt-6 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-card/65">Workspace</p>
        <div className="mt-2">
          <AppNav variant="sidebar" />
        </div>
        <div className="mt-auto space-y-3 border-t border-card/10 px-3 pt-4 text-xs text-card/55">
          {!dryRun && <HeaderWallet accountId={owner?.accountId ?? null} />}
          <p>Bursar pays only inside the limits you set. Your invoices are read privately.</p>
          <Link href="/" className="inline-block text-card/80 underline decoration-card/30 hover:text-card">
            About Bursar
          </Link>
        </div>
      </aside>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Phone header */}
        <header className="bg-night px-4 pb-2 pt-3 text-card lg:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <Link href="/this-week" aria-label="Bursar, this week">
              <Logo tone="light" />
            </Link>
            {!dryRun && <HeaderWallet accountId={owner?.accountId ?? null} />}
          </div>
          <AppNav variant="bar" />
        </header>

        {/* Top bar */}
        <div className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-[2px]">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
            <p className="flex items-center gap-2 text-sm text-muted">
              {business && (
                <>
                  <span className="hidden sm:inline">{business.name}</span> <span aria-hidden className="hidden sm:inline">/</span>
                </>
              )}
              <PageName />
            </p>
            <div className="flex items-center gap-3">
              <ModeBadge dryRun={dryRun} />
            </div>
          </div>
        </div>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 [overflow-wrap:anywhere] sm:px-8">{children}</main>
      </div>
    </div>
  );
}
