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
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${active ? "bg-card text-ink" : "text-card/75 hover:bg-night-2 hover:text-card"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
