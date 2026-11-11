import Link from "next/link";
import { redirect } from "next/navigation";
import { SideNav, TabBar } from "@/components/app-nav";
import { HeaderWallet } from "@/components/header-wallet";
import { Logo } from "@/components/logo";
import { connection } from "next/server";
import { readEnv } from "@/lib/env";
import { getOwner, appDb } from "@/lib/session";
import { getBusiness } from "@/lib/store";
import { pendingChanges } from "@/lib/pending-changes";
import { PendingChangesBar } from "@/components/pending-changes-bar";

/** A business's own pages stay out of search engines. */
export const metadata = { robots: { index: false, follow: false } };

/** Practice mode only: real money is the normal case and needs no label. */
function PracticeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-hold-soft px-2.5 py-1 text-xs font-semibold text-hold" title="You're exploring with practice money. Nothing real is paid.">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-hold" />
      Demo · practice money
    </span>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  await connection();
  const owner = dryRun ? null : await getOwner();
  const business = await getBusiness(await appDb());
  // Signed out first (returning owners sign in), then a signed-in wallet with no business yet goes to setup.
  // Each page also checks (lib/session guardPage): a layout check alone doesn't stop a page rendering.
  if (!dryRun && !owner) redirect("/signin");
  if (!dryRun && !business) redirect("/welcome");
  // Live: changes made in Bursr that the owner's wallet hasn't confirmed yet, shown on every page.
  const pending = !dryRun && business ? await pendingChanges(await appDb()) : null;
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* Sidebar (large screens) */}
      <div className="hidden border-r border-line bg-card lg:block">
        <aside className="sticky top-0 flex h-[100dvh] flex-col px-3 py-5">
          <Link href="/this-week" aria-label="Bursr home" className="px-3">
            <Logo />
          </Link>
          {business && <p className="mt-1 truncate px-3 text-xs text-muted">{business.name}</p>}
          <div className="mt-8">
            <SideNav />
          </div>
          <Link href="/" className="mt-auto px-3 text-xs text-muted hover:text-ink">
            About Bursr
          </Link>
        </aside>
      </div>

      <div className="flex min-w-0 flex-col pb-20 lg:pb-0">
        {/* Top bar */}
        <div className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
            <span className="flex items-center gap-3">
              <Link href="/this-week" aria-label="Bursr home" className="lg:hidden">
                <Logo />
              </Link>
              <span className="hidden text-sm text-muted lg:inline">
                {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </span>
            <div className="flex min-w-0 items-center gap-3">{dryRun ? <PracticeBadge /> : <HeaderWallet accountId={owner?.accountId ?? null} tone="dark" />}</div>
          </div>
        </div>

        {pending && <PendingChangesBar lines={pending.lines} onlyTighter={pending.onlyTighter} />}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 [overflow-wrap:anywhere] sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}
