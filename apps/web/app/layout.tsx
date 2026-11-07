import type { Metadata } from "next";
import { Archivo, Homemade_Apple, Martian_Mono } from "next/font/google";
import "./globals.css";

// Archivo carries its width axis: expanded for printed cheque fields, normal for reading.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"] });
// The owner's own hand, used only for the payee line and the signature.
const hand = Homemade_Apple({ variable: "--font-hand-apple", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Bursar: pay everyone, never the wrong person",
  description: "Bursar checks your supplier invoices for fraud and pays everyone once you approve. Safely, inside the limits you set.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${martian.variable} ${hand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
