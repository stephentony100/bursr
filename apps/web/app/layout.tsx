import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { readEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] });

const site = readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
const description =
  "Bursr is an AI agent that pays your staff and suppliers in stablecoins on any network. It checks invoices for fraud and pays inside limits it can't change.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Bursr: pay everyone, never the wrong person", template: "%s · Bursr" },
  description,
  applicationName: "Bursr",
  keywords: ["payroll", "supplier payments", "stablecoin payments", "USDC", "AI agent", "invoice fraud", "small business", "Nigeria", "NEAR Intents"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Bursr", url: "/", title: "Bursr: pay everyone, never the wrong person", description, locale: "en_NG" },
  twitter: { card: "summary_large_image", title: "Bursr: pay everyone, never the wrong person", description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#0b1220", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
