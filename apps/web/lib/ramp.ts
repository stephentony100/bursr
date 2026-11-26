import { type LinqClient, usdcUnitsFromDecimal } from "./linq";

// Naira in and out. A ramp provider turns naira into USDC delivered to the
// business's vault ("on") and USDC from the vault into naira at a bank
// ("off"). Bursr talks to one provider through this interface:
// - practice: no real money. A fixed rate and made-up bank details; on the
//   Stellar test network the USDC moves on chain (lib/ramp-orders.ts).
// - linq: Linq's business API (mainnet only, real money). Cash-out today;
//   naira in waits until Bursr is registered with Linq as a business.
// Amounts are integers: USD in micro-dollars (6 decimals), naira in kobo.

export type RampKind = "on" | "off";

export class RampError extends Error {}

export interface RampQuote {
  ngnKobo: bigint;
  koboPerUsd: bigint;
  expiresAt: Date;
}

export interface BankAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export { NIGERIAN_BANKS, PRACTICE_BANK } from "./banks";

/** What a naira-in order came back with: where to send the naira, and what the provider locked on it. */
export interface OnRampOrder extends Omit<BankAccount, "bankCode"> {
  reference: string;
  providerOrderId: string | null;
  ngnKobo: bigint;
  feeKobo: bigint;
  expiresAt: Date | null;
}

/** What a cash-out order came back with: where the vault pays, and the amounts locked on it. */
export interface OffRampOrder {
  depositAddress: string;
  providerOrderId: string | null;
  usdMicros: bigint;
  ngnKobo: bigint;
  koboPerUsd: bigint;
}

export interface RampProvider {
  name: "practice" | "linq";
  quote(kind: RampKind, usdMicros: bigint): Promise<RampQuote>;
  /** Naira in: where the owner sends the naira, and the reference to use. `customerRef`: the verified person (Linq). */
  startOnRamp(p: { orderId: string; usdMicros: bigint; ngnKobo: bigint; deliverTo: string; customerRef: string }): Promise<OnRampOrder>;
  /** Naira out: the one-time address the vault pays the USDC to. `refundAddress`: where a failed payout's USDC comes back. */
  startOffRamp(p: { orderId: string; usdMicros: bigint; ngnKobo: bigint; bank: BankAccount; customerRef: string; refundAddress: string }): Promise<OffRampOrder>;
  /** The name on a bank account, so the owner sees who they're paying before they confirm. */
  accountName(bankCode: string, accountNumber: string): Promise<string>;
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
    async startOnRamp({ orderId, ngnKobo }) {
      return { bankName: "Practice Bank (no real money)", accountNumber: "0000000000", accountName: "Bursr Practice", reference: orderId, providerOrderId: null, ngnKobo, feeKobo: 0n, expiresAt: null };
    },
    async startOffRamp({ usdMicros, ngnKobo }) {
      return { depositAddress: sink(), providerOrderId: null, usdMicros, ngnKobo, koboPerUsd: PRACTICE_KOBO_PER_USD };
    },
    async accountName(_bankCode, accountNumber) {
      checkAccountNumber(accountNumber);
      return "Practice account holder";
    },
  };
}

export const practiceRamp = makePracticeRamp(() => {
  throw new RampError("Practice cash-out needs Bursr's test fee account.");
});

function checkAccountNumber(accountNumber: string) {
  if (!/^\d{10}$/.test(accountNumber)) throw new RampError("A Nigerian account number has 10 digits.");
}

/** Linq's cash-out quotes are in whole cents of USDC. */
function cents(usdMicros: bigint): string {
  if (usdMicros % 10_000n !== 0n) throw new RampError("Enter the amount in dollars and cents, like 25.50.");
  return `${usdMicros / 1_000_000n}.${((usdMicros % 1_000_000n) / 10_000n).toString().padStart(2, "0")}`;
}

/** Linq's business API: cash-out to a bank on Stellar in USDC. Naira in waits for Bursr's business registration with Linq. */
export function makeLinqRamp(linq: LinqClient): RampProvider {
  return {
    name: "linq",
    async quote(kind, usdMicros) {
      if (usdMicros <= 0n) throw new RampError("Enter an amount more than zero.");
      cents(usdMicros);
      // Display only: Linq locks the rate (and, for naira in, the naira amount) on the order.
      const koboPerUsd = BigInt(Math.round((kind === "on" ? await linq.onrampRate() : await linq.rate()) * 100));
      return { ngnKobo: ngnFor(usdMicros, koboPerUsd, kind), koboPerUsd, expiresAt: new Date(Date.now() + 9 * 60 * 1000) };
    },
    async startOnRamp({ usdMicros, deliverTo, customerRef }) {
      // For USDC the rate is /onramprate's NGN per USD, passed straight through (docs: "B2B onramp").
      const o = await linq.createOnramp({ customerRef, amountStableCoin: cents(usdMicros), walletAddress: deliverTo, rate: await linq.onrampRate() });
      return {
        bankName: o.bankName,
        accountNumber: o.accountNumber,
        accountName: o.accountName,
        reference: o.orderId,
        providerOrderId: o.orderId,
        ngnKobo: BigInt(Math.round(Number(o.amountNgn) * 100)),
        feeKobo: BigInt(Math.round(Number(o.fee ?? 0) * 100)),
        expiresAt: new Date(o.expiresAt),
      };
    },
    async startOffRamp({ orderId, usdMicros, bank, customerRef, refundAddress }) {
      const o = await linq.createOfframp({ amountStableCoin: cents(usdMicros), bankAccount: bank.accountNumber, bankCode: bank.bankCode, bankName: bank.bankName, accountName: bank.accountName, refundAddress, customerRef, idempotencyKey: orderId });
      return {
        depositAddress: o.walletAddress,
        providerOrderId: o.id,
        usdMicros: usdcUnitsFromDecimal(o.amountStableCoin, 6),
        ngnKobo: BigInt(Math.round(Number(o.amountNGN) * 100)), // shown to the owner; Linq pays exactly amountNGN
        koboPerUsd: BigInt(Math.round(Number(o.rate) * 100)), // shown to the owner; the payout is amountNGN
      };
    },
    async accountName(bankCode, accountNumber) {
      checkAccountNumber(accountNumber);
      return linq.verifyBank(bankCode, accountNumber);
    },
  };
}
