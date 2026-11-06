import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { readEnv } from "@/lib/env";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Bursar",
  description: "Pays your business bills inside the rules you set.",
};

const NAV = [
  { href: "/", label: "This week" },
  { href: "/invoices", label: "Invoices" },
  { href: "/setup", label: "Rules & account" },
  { href: "/payees", label: "Payees" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
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
            <span
              className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${dryRun ? "bg-hold-soft text-hold" : "bg-refuse-soft text-refuse"}`}
              title={dryRun ? "Sample data and demo money. Nothing real is paid." : "Real payments on NEAR mainnet."}
            >
              {dryRun ? "Practice mode: demo money" : "Live: real money"}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
