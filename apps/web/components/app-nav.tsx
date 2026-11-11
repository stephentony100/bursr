"use client";

import { Books, CalendarCheck, PaperPlaneTilt, Receipt, ShieldCheck, UsersThree, type Icon, Robot, Wallet } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: Icon; hint: string }[] = [
  { href: "/this-week", label: "This week", icon: CalendarCheck, hint: "Overview" },
  { href: "/agent", label: "Agent", icon: Robot, hint: "Chat and activity" },
  { href: "/invoices", label: "Invoices", icon: Receipt, hint: "Checked bills" },
  { href: "/payments", label: "Payments", icon: PaperPlaneTilt, hint: "This week's list" },
  { href: "/records", label: "Records", icon: Books, hint: "For your accountant" },
  { href: "/people", label: "People", icon: UsersThree, hint: "Who you pay" },
  { href: "/spending-rules", label: "Spending rules", icon: ShieldCheck, hint: "Limits and stop" },
  { href: "/add-money", label: "Add money", icon: Wallet, hint: "Top up or take back" },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Sidebar navigation on large screens; a scrolling tab row on phones. */
export function AppNav({ variant }: { variant: "sidebar" | "bar" }) {
  const path = usePathname();
  if (variant === "bar") {
    return (
      <nav aria-label="Main" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {NAV.map((n) => {
          const active = isActive(path, n.href);
          const Glyph = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${active ? "bg-card text-ink" : "text-card/75 hover:bg-night-2 hover:text-card"}`}
            >
              <Glyph size={16} weight={active ? "fill" : "regular"} aria-hidden />
              {n.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const active = isActive(path, n.href);
        const Glyph = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors duration-150 ${active ? "bg-night-2 text-card" : "text-card/70 hover:bg-night-2/60 hover:text-card"}`}
          >
            {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[#6ee7b7]" />}
            <Glyph size={19} weight={active ? "fill" : "regular"} aria-hidden className={active ? "text-[#6ee7b7]" : ""} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">{n.label}</span>
              <span className="block text-[0.7rem] leading-tight text-card/65">{n.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The current page's name for the top bar. */
export function PageName() {
  const path = usePathname();
  const n = NAV.find((x) => isActive(path, x.href));
  return <span className="text-sm font-semibold text-ink">{n?.label ?? "Bursar"}</span>;
}
