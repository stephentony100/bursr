import { Logo } from "@/components/logo";
import { Crossing, GuillocheBand, Rosette } from "./paper";

// The home page's first-viewport object: this week's cheque to Mama Put Farms
// Ltd (the sample's first clean invoice), crossed A/C PAYEE ONLY, with the
// four checks Bursar ran ticked in ink after the crossing draws.

function Tick({ label, delay }: { label: string; delay: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-[0.72rem] font-semibold text-ink">
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
        <path d="M2.5 8.5 L6.5 12.5 L13.5 3.5" pathLength={1} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="draw" style={{ animationDelay: `${delay}ms` }} />
      </svg>
      <span className="tick-in hidden sm:inline" style={{ animationDelay: `${delay + 160}ms` }}>
        {label}
      </span>
      <span className="sr-only sm:hidden">{label}</span>
    </span>
  );
}

function Field({ label, children, tick }: { label: string; children: React.ReactNode; tick?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 sm:grid-cols-[5.9rem_minmax(0,1fr)_auto]">
      <span className="field-label col-span-2 whitespace-nowrap text-muted sm:col-span-1 sm:pb-1">{label}</span>
      <div className="min-w-0 border-b border-ink/30 pb-0.5">{children}</div>
      {tick}
    </div>
  );
}

export function Cheque({ account }: { account: string }) {
  const short = `${account.slice(0, 6)}…${account.slice(-4)}`;
  return (
    <figure className="min-w-0" aria-label="A cheque for $118.00 to Mama Put Farms Ltd, crossed A/C payee only, with four checks passed">
      <div className="relative grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[6px] border border-ink/20 bg-card shadow-[0_30px_60px_-34px_rgb(22_32_42/0.6)] sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        {/* Counterfoil */}
        <div className="hidden border-r-2 border-dotted border-ink/30 bg-paper-2 p-4 sm:block">
          <p className="field-label text-muted">Counterfoil</p>
          <p className="mt-1 text-sm">
            No. <span className="num">000412</span>
          </p>
          <dl className="mt-4 space-y-3 text-[0.78rem] leading-snug">
            <div>
              <dt className="field-label text-muted">To</dt>
              <dd className="font-semibold">Mama Put Farms Ltd</dd>
            </div>
            <div>
              <dt className="field-label text-muted">For</dt>
              <dd>Invoice MPF-0412</dd>
            </div>
            <div>
              <dt className="field-label text-muted">Amount</dt>
              <dd className="num font-medium">$118.00</dd>
            </div>
          </dl>
        </div>

        {/* Cheque body */}
        <div className="relative px-5 pb-4 pt-4 sm:px-6">
          <GuillocheBand className="pointer-events-none absolute inset-x-0 top-0 h-16 w-full" opacity={0.28} />
          <Rosette className="pointer-events-none absolute -right-8 -top-8 hidden h-36 w-36 opacity-40 sm:block" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <Logo className="origin-left scale-90" />
              <p className="mt-0.5 text-[0.72rem] text-muted">Bukka Corner Restaurant</p>
            </div>
            <p className="pt-1 text-right">
              <span className="field-label block text-muted">Date</span>
              <span className="text-sm font-semibold">Friday, payday</span>
            </p>
          </div>

          <div className="relative mt-5 space-y-3.5">
            <Field label="Pay" tick={<Tick label="On your list" delay={1050} />}>
              <span className="hand block text-[0.95rem] leading-[2.1] sm:text-[1.2rem]">Mama Put Farms Ltd</span>
            </Field>
            <Field label="The sum of" tick={<Tick label="As agreed" delay={1250} />}>
              <span className="hand block text-[0.8rem] leading-[2.2] sm:text-[0.95rem]">One hundred and eighteen dollars only</span>
            </Field>
            <Field label="Into" tick={<Tick label="Same as always" delay={1450} />}>
              <span className="block py-1 text-[0.82rem]">
                USDC on NEAR, <span className="num">{short}</span>
              </span>
            </Field>
            <Field label="For" tick={<Tick label="Not paid before" delay={1650} />}>
              <span className="block py-1 text-[0.85rem]">Invoice MPF-0412</span>
            </Field>
          </div>

          <div className="relative mt-5 flex items-end justify-between gap-4">
            <p className="num rounded-[3px] border-2 border-ink px-3 py-1.5 text-lg font-semibold sm:text-xl">$118.00</p>
            <div className="text-right">
              <p className="hand border-b border-ink/40 px-2 text-[1rem] leading-[2.2]">Bukka Corner</p>
              <p className="field-label mt-1 text-muted">Signed once for the week</p>
            </div>
          </div>

          <p className="num relative mt-4 border-t border-ink/15 pt-2 text-[0.72rem] tracking-[0.18em] text-ink/70">000412 &nbsp; 0118 00 &nbsp; NEAR</p>

          {/* The crossing, drawn across the cheque like a pen stroke */}
          <Crossing delay={350} className="absolute left-[40%] top-[3%] w-[30%] sm:left-[36%] sm:w-[34%]" />
        </div>
      </div>
    </figure>
  );
}
