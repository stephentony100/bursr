import { PALETTE } from "@/lib/palette";

// Bursr's mark: the "fan-out" tile, one source node (the agent) branching to
// three payees. Geometry and colours from the logo handoff (design_handoff_bursr_logo,
// 48-unit grid, viewBox 3 3 42 42). The production SVGs are in public/brand.

type Variant = "primary" | "reversed" | "mono";

const COLOURS: Record<Exclude<Variant, "mono">, { tile: string; fan: string; dots: string }> = {
  // On light backgrounds: blue tile, white fan, navy payee dots.
  primary: { tile: PALETTE.ledger, fan: PALETTE.card, dots: PALETTE.ink },
  // On navy or blue backgrounds: white tile, navy fan, blue payee dots.
  reversed: { tile: PALETTE.card, fan: PALETTE.ink, dots: PALETTE.ledger },
};

export function Mark({ size = 34, variant = "primary", className = "" }: { size?: number; variant?: Variant; className?: string }) {
  if (variant === "mono") {
    // One colour (currentColor) with the fan knocked out, for single-colour use.
    return (
      <svg width={size} height={size} viewBox="3 3 42 42" aria-hidden="true" className={className}>
        <mask id="bursr-fan">
          <rect x="3" y="3" width="42" height="42" rx="12" fill="#fff" />
          <g fill="none" stroke="#000" strokeWidth="3.2" strokeLinecap="round">
            <path d="M16 24C22 24 24 15 30 15" />
            <path d="M16 24L31 24" />
            <path d="M16 24C22 24 24 33 30 33" />
          </g>
          <circle cx="15" cy="24" r="5" fill="#000" />
          <circle cx="33.5" cy="15" r="3.6" fill="#000" />
          <circle cx="34.5" cy="24" r="3.6" fill="#000" />
          <circle cx="33.5" cy="33" r="3.6" fill="#000" />
        </mask>
        <rect x="3" y="3" width="42" height="42" rx="12" fill="currentColor" mask="url(#bursr-fan)" />
      </svg>
    );
  }
  const c = COLOURS[variant];
  return (
    <svg width={size} height={size} viewBox="3 3 42 42" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="42" height="42" rx="12" fill={c.tile} />
      <g fill="none" stroke={c.fan} strokeWidth="3.2" strokeLinecap="round">
        <path d="M16 24C22 24 24 15 30 15" />
        <path d="M16 24L31 24" />
        <path d="M16 24C22 24 24 33 30 33" />
      </g>
      <circle cx="15" cy="24" r="5" fill={c.fan} />
      <circle cx="33.5" cy="15" r="3.6" fill={c.dots} />
      <circle cx="34.5" cy="24" r="3.6" fill={c.dots} />
      <circle cx="33.5" cy="33" r="3.6" fill={c.dots} />
    </svg>
  );
}

/**
 * Mark + "Bursr" wordmark (Plus Jakarta Sans 800, -0.045em). The mark is about
 * 1.2× the wordmark's size and the gap about a quarter of the mark (handoff):
 * "md" is the site nav (34px mark, 26px word, 8px gap); "sm" for the app's bars.
 * `tone="light"` is for dark backgrounds: the reversed mark and a white word.
 */
export function Logo({
  className = "",
  tone = "ink",
  size = "md",
  withWordmark = true,
}: {
  className?: string;
  tone?: "ink" | "light";
  size?: "sm" | "md";
  withWordmark?: boolean;
}) {
  const [mark, word, gap] = size === "md" ? [34, 26, 8] : [28, 22, 7];
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap }}>
      <Mark size={mark} variant={tone === "light" ? "reversed" : "primary"} />
      {withWordmark && (
        <span
          className="font-[family-name:var(--font-display)] font-extrabold leading-none"
          style={{ fontSize: word, letterSpacing: "-0.045em", color: tone === "light" ? PALETTE.card : PALETTE.ink }}
        >
          Bursr
        </span>
      )}
    </span>
  );
}
