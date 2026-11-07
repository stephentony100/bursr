import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { HeaderWallet } from "@/components/header-wallet";
import { readEnv } from "@/lib/env";
import { getOwner } from "@/lib/session";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Bursar",
  description: "Bursar checks your supplier invoices for fraud and pays everyone once you approve. Safely, inside the limits you set.",
};

const NAV = [
  { href: "/", label: "This week" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/records", label: "Records" },
  { href: "/people", label: "People" },
  { href: "/spending-rules", label: "Spending rules" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const owner = dryRun ? null : await getOwner();
  return (
    <html lang="en" className={`${bricolage.variable} ${publicSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
            <Link href="/" className="font-display text-2xl font-bold tracking-tight">
              Bursar
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted hover:bg-paper hover:text-ink">
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto flex flex-wrap items-center gap-3">
            {!dryRun && <HeaderWallet accountId={owner?.accountId ?? null} />}
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${dryRun ? "bg-hold-soft text-hold" : "bg-refuse-soft text-refuse"}`}
              title={dryRun ? "You're exploring with a sample restaurant and practice money. Nothing real is paid." : "Real money. Payments go out for real."}
            >
              {dryRun ? "Demo · practice money" : "Live · real money"}
            </span>
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
