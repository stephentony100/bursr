import { Lock } from "@phosphor-icons/react/dist/ssr";

/** A wireframe room with an invoice sealed inside: where NEAR AI reads it. Exact geometry. */
export function SealedRoom() {
  const edge = "#1d6a60";
  return (
    <div className="relative rounded-[12px] border border-ink/15 bg-card p-8">
      <svg viewBox="0 0 300 270" className="mx-auto block w-full max-w-[340px]" aria-hidden>
        <path d="M40 190L150 130L260 190M150 30V130" fill="none" stroke={edge} strokeOpacity="0.4" strokeDasharray="4 5" />
        <g transform="translate(118 92) rotate(-8)">
          <rect width="64" height="84" rx="3" fill="#edf1ea" stroke="#16202a" strokeOpacity="0.35" />
          <rect x="9" y="10" width="34" height="5" rx="1" fill="#16202a" opacity="0.55" />
          <rect x="9" y="22" width="46" height="3" rx="1" fill="#16202a" opacity="0.2" />
          <rect x="9" y="30" width="40" height="3" rx="1" fill="#16202a" opacity="0.2" />
          <rect x="9" y="38" width="44" height="3" rx="1" fill="#16202a" opacity="0.2" />
          <rect x="9" y="66" width="46" height="6" rx="1" fill={edge} opacity="0.8" />
        </g>
        <path d="M40 90L150 30L260 90L150 150Z" fill={edge} fillOpacity="0.06" stroke={edge} strokeWidth="1.5" />
        <path d="M40 90V190L150 250V150M260 90V190L150 250" fill="none" stroke={edge} strokeWidth="1.5" />
      </svg>
      <p className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-ink">
        <Lock size={16} weight="bold" className="text-ledger" aria-hidden />
        Sealed hardware. Nobody can look inside.
      </p>
    </div>
  );
}
