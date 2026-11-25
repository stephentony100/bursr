// Naira in and out. A ramp provider turns naira into USDC delivered to the
// business's vault ("on") and USDC from the vault into naira at a bank
// ("off"). Bursr talks to one provider through this interface:
// - practice: no real money. A fixed rate and made-up bank details; on the
//   Stellar test network the USDC moves on chain (lib/ramp-orders.ts).
// - linq: Linq's business API, once its docs arrive (not connected yet).
// Amounts are integers: USD in micro-dollars (6 decimals), naira in kobo.

export type RampKind = "on" | "off";

export class RampError extends Error {}

export interface RampQuote {
  ngnKobo: bigint;
  koboPerUsd: bigint;
  expiresAt: Date;
}

export interface BankAccount {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface RampProvider {
  name: "practice" | "linq";
  quote(kind: RampKind, usdMicros: bigint): Promise<RampQuote>;
  /** Naira in: where the owner sends the naira, and the reference to use. */
  startOnRamp(p: { orderId: string; usdMicros: bigint; ngnKobo: bigint; deliverTo: string }): Promise<BankAccount & { reference: string }>;
  /** Naira out: the one-time address the vault pays the USDC to. */
  startOffRamp(p: { orderId: string; usdMicros: bigint; ngnKobo: bigint; bank: BankAccount }): Promise<{ depositAddress: string }>;
  /** The name on a bank account, so the owner sees who they're paying before they confirm. */
  accountName(bankName: string, accountNumber: string): Promise<string>;
}

/** Naira for a USD amount. Naira in rounds up (the owner pays enough), naira out rounds down. */
export function ngnFor(usdMicros: bigint, koboPerUsd: bigint, kind: RampKind): bigint {
  const num = usdMicros * koboPerUsd;
  const whole = num / 1_000_000n;
  return kind === "on" && num % 1_000_000n !== 0n ? whole + 1n : whole;
}

export function formatNgn(kobo: bigint): string {
  const naira = (kobo / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₦${naira}.${(kobo % 100n).toString().padStart(2, "0")}`;
}

/** Practice rate: ₦1,600 per $1. */
export const PRACTICE_KOBO_PER_USD = 160_000n;
const PRACTICE_MAX_USD = 100_000_000n; // $100 an order
const QUOTE_MS = 10 * 60 * 1000;

function checkAmount(usdMicros: bigint, max: bigint) {
  if (usdMicros <= 0n) throw new RampError("Enter an amount more than zero.");
  if (usdMicros > max) throw new RampError(`In practice, one order can be up to $${max / 1_000_000n}.`);
}

/** A practice provider. `sink`: the practice account that receives cash-out USDC (Bursr's test fee account). */
export function makePracticeRamp(sink: () => string): RampProvider {
  return {
    name: "practice",
    async quote(kind, usdMicros) {
      checkAmount(usdMicros, PRACTICE_MAX_USD);
      return { ngnKobo: ngnFor(usdMicros, PRACTICE_KOBO_PER_USD, kind), koboPerUsd: PRACTICE_KOBO_PER_USD, expiresAt: new Date(Date.now() + QUOTE_MS) };
    },
    async startOnRamp({ orderId }) {
      return { bankName: "Practice Bank (no real money)", accountNumber: "0000000000", accountName: "Bursr Practice", reference: orderId };
    },
    async startOffRamp() {
      return { depositAddress: sink() };
    },
    async accountName(_bankName, accountNumber) {
      if (!/^\d{10}$/.test(accountNumber)) throw new RampError("A Nigerian account number has 10 digits.");
      return "Practice account holder";
    },
  };
}

export const practiceRamp = makePracticeRamp(() => {
  throw new RampError("Practice cash-out needs Bursr's test fee account.");
});

/** Linq's business API: not connected until its docs arrive. */
export const linqRamp: RampProvider = {
  name: "linq",
  async quote() {
    throw new RampError("Naira through Linq isn't connected yet.");
  },
  async startOnRamp() {
    throw new RampError("Naira through Linq isn't connected yet.");
  },
  async startOffRamp() {
    throw new RampError("Naira through Linq isn't connected yet.");
  },
  async accountName() {
    throw new RampError("Naira through Linq isn't connected yet.");
  },
};
