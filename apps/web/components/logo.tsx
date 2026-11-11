/** Bursr's mark: a geometric "b" on a blue tile. Drawn here; no external artwork. */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="9" fill="#2f4bdb" />
      <path d="M11 7.5v17" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
      <circle cx="16.8" cy="18.6" r="5.8" fill="none" stroke="#fff" strokeWidth="3.6" />
    </svg>
  );
}

export function Logo({ className = "", tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark />
      <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[-0.04em]" style={{ color: tone === "light" ? "#ffffff" : "#0b1220" }}>
        Bursr
      </span>
    </span>
  );
}
