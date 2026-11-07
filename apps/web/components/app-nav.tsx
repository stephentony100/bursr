"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/this-week", label: "This week" },
  { href: "/invoices", label: "Invoices" },
  { href: "/payments", label: "Payments" },
  { href: "/records", label: "Records" },
  { href: "/people", label: "People" },
  { href: "/spending-rules", label: "Spending rules" },
];

export function AppNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap gap-1">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(`${n.href}/`);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`eyebrow rounded-md px-3 py-2 transition-colors ${active ? "bg-cream text-night" : "text-cream/70 hover:bg-night-2 hover:text-cream"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
