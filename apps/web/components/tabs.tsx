"use client";

import { useSyncExternalStore } from "react";

// Tabs that show one panel at a time; a link like /people#pay-once opens that tab.

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function Tabs({ tabs, label }: { tabs: { id: string; label: string; panel: React.ReactNode }[]; label: string }) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash.slice(1), () => "");
  const active = tabs.some((t) => t.id === hash) ? hash : tabs[0].id;
  const setActive = (id: string) => {
    history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return (
    <div>
      <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active === t.id ? "bg-ink text-white" : "bg-card text-muted ring-1 ring-line hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="mt-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
          {t.panel}
        </div>
      ))}
    </div>
  );
}
