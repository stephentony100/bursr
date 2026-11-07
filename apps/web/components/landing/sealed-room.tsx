import { Seal } from "./paper";

/** A wireframe room with an invoice sealed inside: where NEAR AI reads it. */
export function SealedRoom() {
  const edge = "#4fd1a0";
  return (
    <div className="relative overflow-hidden rounded-3xl bg-night p-8 text-cream">
      <div aria-hidden className="ledger-grid absolute inset-0 opacity-70" />
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_55%,rgb(79_209_160/0.22),transparent)]" />
      <svg viewBox="0 0 300 270" className="relative mx-auto block w-full max-w-[340px]" aria-hidden>
        {/* hidden back edges */}
        <path d="M40 190L150 130L260 190M150 30V130" fill="none" stroke={edge} strokeOpacity="0.35" strokeDasharray="4 5" />
        {/* the invoice, floating inside */}
        <g transform="translate(118 92) rotate(-8)">
          <rect width="64" height="84" rx="5" fill="#fbf6ea" />
          <rect x="9" y="10" width="34" height="5" rx="2" fill="#1b2430" opacity="0.5" />
          <rect x="9" y="22" width="46" height="3" rx="1.5" fill="#1b2430" opacity="0.2" />
          <rect x="9" y="30" width="40" height="3" rx="1.5" fill="#1b2430" opacity="0.2" />
          <rect x="9" y="38" width="44" height="3" rx="1.5" fill="#1b2430" opacity="0.2" />
          <rect x="9" y="66" width="46" height="6" rx="2" fill="#0f6b4f" opacity="0.7" />
        </g>
        {/* front edges */}
        <path d="M40 90L150 30L260 90L150 150Z" fill={edge} fillOpacity="0.06" stroke={edge} strokeWidth="1.5" />
        <path d="M40 90V190L150 250V150M260 90V190L150 250" fill="none" stroke={edge} strokeWidth="1.5" />
        <path d="M40 90V190L150 250V150Z" fill={edge} fillOpacity="0.05" />
        {/* lock on the front */}
        <g transform="translate(196 168)">
          <rect x="-13" y="-4" width="26" height="22" rx="4" fill="#0a1813" stroke={edge} strokeWidth="1.5" />
          <path d="M-7 -4v-6a7 7 0 0 1 14 0v6" fill="none" stroke={edge} strokeWidth="1.5" />
          <circle cy="7" r="2.5" fill={edge} />
        </g>
      </svg>
      <Seal id="seal-room" className="absolute -bottom-8 -right-8 h-32 w-32 text-cream/50" />
      <p className="eyebrow relative mt-2 text-center text-cream/60">Sealed hardware · nobody can look inside</p>
    </div>
  );
}
