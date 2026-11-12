import type { Metadata, Viewport } from "next";
import { PALETTE } from "@/lib/palette";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { readEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

const site = readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
const description =
  "Bursr is an AI payroll agent for small businesses. It pays your staff and suppliers in stablecoins on any network, checks every invoice, and can't go past your limits.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Bursr: the AI payroll agent for small businesses", template: "%s · Bursr" },
  description,
  applicationName: "Bursr",
  keywords: ["AI payroll agent", "payroll", "supplier payments", "stablecoin payments", "USDC", "AI agent", "invoice fraud", "small business", "Nigeria", "NEAR Intents"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Bursr", url: "/", title: "Bursr: the AI payroll agent for small businesses", description, locale: "en_NG" },
  twitter: { card: "summary_large_image", title: "Bursr: the AI payroll agent for small businesses", description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: PALETTE.ink, width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
