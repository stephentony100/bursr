"use client";

import { Books, DotsThreeOutline, House, PaperPlaneTilt, Receipt, Robot, ShieldCheck, UsersThree, Wallet, X, type Icon } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: Icon };

const MAIN: Item[] = [
  { href: "/this-week", label: "Home", icon: House },
  { href: "/payments", label: "Payments", icon: PaperPlaneTilt },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/people", label: "People", icon: UsersThree },
  { href: "/agent", label: "Agent", icon: Robot },
];
const MONEY: Item[] = [
  { href: "/add-money", label: "Wallet", icon: Wallet },
  { href: "/spending-rules", label: "Limits", icon: ShieldCheck },
  { href: "/records", label: "Records", icon: Books },
];
const ALL = [...MAIN, ...MONEY];
/** Phone tab bar: the four most used, the rest under More. */
const TABS = MAIN.slice(0, 4);
const MORE = [MAIN[4], ...MONEY];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

function SideLink({ item, path }: { item: Item; path: string }) {
  const active = isActive(path, item.href);
  const Glyph = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150 ${active ? "bg-ledger-soft text-ledger" : "text-muted hover:bg-paper hover:text-ink"}`}
    >
      <Glyph size={20} weight={active ? "fill" : "regular"} aria-hidden />
      {item.label}
    </Link>
  );
}

/** Desktop sidebar. */
export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        {MAIN.map((n) => (
          <SideLink key={n.href} item={n} path={path} />
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="px-3 pb-1 text-xs font-semibold text-muted/80">Money</p>
        {MONEY.map((n) => (
          <SideLink key={n.href} item={n} path={path} />
        ))}
      </div>
    </nav>
  );
}

/** Phone: tabs along the bottom, within thumb reach. */
export function TabBar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(path, m.href));
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button aria-label="Close" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-pop)]">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-semibold">More</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-paper">
                <X size={18} aria-hidden />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MORE.map((m) => {
                const Glyph = m.icon;
                const active = isActive(path, m.href);
                return (
                  <Link key={m.href} href={m.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-sm font-semibold ${active ? "border-ledger bg-ledger-soft text-ledger" : "border-line"}`}>
                    <Glyph size={22} aria-hidden /> {m.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((n) => {
            const active = isActive(path, n.href);
            const Glyph = n.icon;
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-semibold ${active ? "text-ledger" : "text-muted"}`}>
                <Glyph size={22} weight={active ? "fill" : "regular"} aria-hidden />
                {n.label}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)} className={`flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-semibold ${moreActive ? "text-ledger" : "text-muted"}`}>
            <DotsThreeOutline size={22} weight={moreActive ? "fill" : "regular"} aria-hidden />
            More
          </button>
        </div>
      </nav>
    </>
  );
}

/** The current page's name for the top bar. */
export function PageName() {
  const path = usePathname();
  const n = ALL.find((x) => isActive(path, x.href));
  return <span className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">{n?.label ?? "Bursr"}</span>;
}
