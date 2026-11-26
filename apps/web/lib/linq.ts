import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { readEnv } from "./env";

// The one module that talks to Linq for Business (naira payouts). Typed
// responses, timeouts, Linq's own error words. Linq is mainnet only: every
// order moves real money. Docs: Linq's private "Linq B2B Offramp API"
// reference (llms-full.txt), 25 Nov 2026.

/** Circle's USDC on Stellar mainnet, as Linq names it in `coinType`. */
export const LINQ_STELLAR_USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

export class LinqError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "LinqError";
  }
}

const Num = z.union([z.number(), z.string()]);

const Bank = z.object({ accountName: z.string().min(1) });
const Rate = z.object({ rate: Num });
const Offramp = z.object({
  id: z.string().min(1),
  walletAddress: z.string().min(1),
  coinType: z.string(),
  chain: z.string().optional(),
  amountStableCoin: Num,
  amountNGN: Num,
  rate: Num,
  status: z.string(),
});
export type LinqOfframp = z.infer<typeof Offramp>;
const Status = z.object({ id: z.string(), status: z.string(), amountStableCoin: Num.optional(), amountNGN: Num.optional() });
export type LinqStatus = z.infer<typeof Status>;
const Trustline = z.object({ valid: z.boolean(), trustsUSDC: z.boolean() });
const Customer = z.object({ verified: z.boolean() });
const OnrampRate = z.union([z.number(), z.string()]);
const Onramp = z.object({
  orderId: z.string().min(1),
  accountNumber: z.string().min(1),
  bankName: z.string().min(1),
  accountName: z.string().default("Linq Onramp Payment"),
  amountNgn: Num,
  amountStableCoin: Num,
  fee: Num.optional(),
  expiresAt: z.string(),
  status: z.string(),
});
export type LinqOnramp = z.infer<typeof Onramp>;
const OnrampStatus = z.object({ orderId: z.string(), status: z.string(), amount: Num.optional(), amountNgn: Num.optional() });

/** The person behind a business, for Linq's KYC (docs: "Provision a customer"). `email` must be real. */
export interface LinqCustomer {
  customerRef: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface OfframpRequest {
  /** USDC to send, as a decimal string with at most 2 places (Linq rounds stablecoin amounts to cents). */
  amountStableCoin: string;
  bankAccount: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  /** Where Linq returns the USDC if the bank payout fails: a Stellar G… account holding a USDC trustline. */
  refundAddress: string;
  customerRef: string;
  idempotencyKey: string;
}

export function linqClient(cfg: { baseUrl: string; apiKey: string }) {
  async function call<T>(path: string, schema: z.ZodType<T>, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (init.auth !== false) headers["X-API-Key"] = cfg.apiKey;
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    if (!res.ok) {
      const msg = json && typeof json === "object" && typeof (json as { message?: unknown }).message === "string" ? (json as { message: string }).message : `Linq answered ${res.status}`;
      throw new LinqError(msg, res.status);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new LinqError("Linq sent back something unexpected.", res.status);
    return parsed.data;
  }

  return {
    /** Naira per US dollar of stablecoin, for display; the rate is locked when an order is made. */
    async rate(): Promise<number> {
      return Number((await call("/b2b/rate", Rate, { auth: false })).rate);
    },
    /** The name on a Nigerian bank account. */
    async verifyBank(bankCode: string, accountNumber: string): Promise<string> {
      return (await call("/b2b/verifybank", Bank, { method: "POST", body: { bankCode, accountNumber } })).accountName;
    },
    /**
     * A cash-out order on Stellar in USDC, for an exact USDC amount that
     * Bursr's vault sends itself (so `manualDeposit` stays false). Refuses an
     * answer that isn't Stellar USDC to a G… account: "funds sent to an
     * address on the wrong chain are unrecoverable".
     */
    async createOfframp(r: OfframpRequest): Promise<LinqOfframp> {
      const o = await call("/b2b/offramp", Offramp, {
        method: "POST",
        body: {
          amountStableCoin: Number(r.amountStableCoin),
          chain: "stellar",
          coin: "usdc",
          bankAccount: r.bankAccount,
          bankCode: r.bankCode,
          bankName: r.bankName,
          accountName: r.accountName,
          currency: "NGN",
          manualDeposit: false,
          refundAddress: r.refundAddress,
          customerRef: r.customerRef,
          idempotencyKey: r.idempotencyKey,
        },
      });
      if (o.chain !== "stellar") throw new LinqError(`Linq gave an address on "${o.chain ?? "an unknown chain"}", not Stellar. Nothing was sent.`, 502);
      if (o.coinType !== LINQ_STELLAR_USDC) throw new LinqError("Linq asked for an asset other than Circle's USDC. Nothing was sent.", 502);
      if (!/^G[A-Z2-7]{55}$/.test(o.walletAddress)) throw new LinqError("Linq's deposit address isn't a Stellar account. Nothing was sent.", 502);
      return o;
    },
    async status(id: string): Promise<LinqStatus> {
      return call(`/b2b/status?id=${encodeURIComponent(id)}`, Status);
    },
    /** Registers the business's person with Linq (safe to repeat: same `customerRef` returns them unchanged). */
    async provisionCustomer(c: LinqCustomer): Promise<{ verified: boolean }> {
      const r = await call("/b2b/customers", Customer, { method: "POST", body: c });
      return { verified: r.verified };
    },
    /** Verifies their NIN ("One call … marks the customer verified immediately"). Bursr never stores the NIN. */
    async submitKyc(customerRef: string, nin: string): Promise<boolean> {
      return (await call("/b2b/customers/kyc", Customer, { method: "POST", body: { customerRef, nin } })).verified;
    },
    /** Naira per US dollar for buying (GET /onramprate, a bare number); passed straight through as `rate` for USDC. */
    async onrampRate(): Promise<number> {
      return Number(await call("/onramprate", OnrampRate, { auth: false }));
    },
    /** Naira in: a bank account the person pays `amountNgn` into; Linq then sends USDC on Stellar to `walletAddress`. */
    async createOnramp(r: { customerRef: string; amountStableCoin: string; walletAddress: string; rate: number }): Promise<LinqOnramp> {
      return call("/b2b/onramp", Onramp, {
        method: "POST",
        body: { customerRef: r.customerRef, amountStableCoin: Number(r.amountStableCoin), currency: "NGN", walletAddress: r.walletAddress, rate: r.rate, coin: { stellar: true } },
      });
    },
    async onrampStatus(customerRef: string, orderId: string) {
      return call(`/b2b/onramp/status?customerRef=${encodeURIComponent(customerRef)}&orderId=${encodeURIComponent(orderId)}`, OnrampStatus);
    },
    /** Whether a Stellar G… account can receive USDC (needed for a refund address). */
    async trustsUsdc(address: string): Promise<boolean> {
      return (await call(`/b2b/stellar/trustline?address=${encodeURIComponent(address)}`, Trustline)).trustsUSDC;
    },
  };
}

export type LinqClient = ReturnType<typeof linqClient>;

/** The client from .env (LINQ_BASE_URL, LINQ_API_KEY). */
export function linqFromEnv(): LinqClient {
  const env = readEnv();
  if (!env.LINQ_BASE_URL || !env.LINQ_API_KEY) throw new LinqError("Set LINQ_BASE_URL and LINQ_API_KEY in .env to use Linq.", 500);
  return linqClient({ baseUrl: env.LINQ_BASE_URL, apiKey: env.LINQ_API_KEY });
}

/** A decimal amount from Linq (a JSON number or string) to integer units, refusing anything finer than `decimals`. */
export function usdcUnitsFromDecimal(v: number | string, decimals: number): bigint {
  const s = typeof v === "number" ? v.toFixed(decimals + 2) : v.trim();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new LinqError(`Unexpected amount from Linq: ${String(v)}`, 502);
  const frac = (m[2] ?? "").replace(/0+$/, "");
  if (frac.length > decimals) throw new LinqError(`Linq's amount ${String(v)} is finer than ${decimals} decimals.`, 502);
  return BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt((frac || "0").padEnd(decimals, "0"));
}

/** Linq signs each webhook: `X-Linq-Signature: sha256=<hex HMAC-SHA256 of the raw body>` with the webhook secret. */
export function verifyLinqSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex"));
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
