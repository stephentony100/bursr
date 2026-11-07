/** Bursar's mark: a ledger page with a tick. Drawn here; no external artwork. */
export function Logo({ className = "", tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  const fg = tone === "light" ? "#fbf6ea" : "#1b2430";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="3" y="2" width="18" height="22" rx="3" fill="none" stroke={fg} strokeWidth="2" />
        <path d="M7 8h10M7 12h6" stroke={fg} strokeWidth="2" strokeLinecap="round" />
        <path d="M11 18.5l3 3 7.5-8" fill="none" stroke="#4fd1a0" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-xl font-bold tracking-tight" style={{ color: fg }}>
        Bursar
      </span>
    </span>
  );
}
