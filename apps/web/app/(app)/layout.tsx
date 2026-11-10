import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav, PageName } from "@/components/app-nav";
import { HeaderWallet } from "@/components/header-wallet";
import { Logo } from "@/components/logo";
import { connection } from "next/server";
import { readEnv } from "@/lib/env";
import { getOwner, appDb } from "@/lib/session";
import { getBusiness } from "@/lib/store";

/** Practice mode only: real money is the normal case and needs no label. */
function PracticeBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-hold-soft px-2.5 py-1 text-xs font-semibold text-hold"
      title="You're exploring with practice money. Nothing real is paid."
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-hold" />
      Demo · practice money
    </span>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  await connection();
  const owner = dryRun ? null : await getOwner();
  const business = await getBusiness((await appDb()));
  if (!dryRun && !business) redirect("/welcome");
  // Each page also checks (lib/session guardPage): a layout check alone doesn't stop a page rendering.
  if (!dryRun && (!owner || business?.ownerAccountId !== owner.accountId)) redirect("/signin");
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
              {dryRun ? <PracticeBadge /> : <span className="hidden lg:block"><HeaderWallet accountId={owner?.accountId ?? null} tone="dark" /></span>}
            </div>
          </div>
        </div>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 [overflow-wrap:anywhere] sm:px-8">{children}</main>
      </div>
    </div>
  );
}
