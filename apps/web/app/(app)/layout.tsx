import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { HeaderWallet } from "@/components/header-wallet";
import { Logo } from "@/components/logo";
import { readEnv } from "@/lib/env";
import { getOwner } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const owner = dryRun ? null : await getOwner();
  return (
    <>
      <header className="ledger-grid bg-night text-cream">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <Link href="/this-week" aria-label="Bursar, this week">
            <Logo tone="light" />
          </Link>
          <AppNav />
          <span className="ml-auto flex flex-wrap items-center gap-3">
            {!dryRun && <HeaderWallet accountId={owner?.accountId ?? null} />}
            <span
              className={`eyebrow rounded-full px-3 py-1 ${dryRun ? "bg-mint/15 text-mint" : "bg-stamp/20 text-[#ffb4ae]"}`}
              title={dryRun ? "You're exploring with a sample restaurant and practice money. Nothing real is paid." : "Real money. Payments go out for real."}
            >
              {dryRun ? "Demo · practice money" : "Live · real money"}
            </span>
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 px-5 py-5 text-xs text-muted">
          <span>Bursar pays only inside the limits you set. Your invoices are read privately.</span>
          <Link href="/" className="underline">
            About Bursar
          </Link>
        </div>
      </footer>
    </>
  );
}
