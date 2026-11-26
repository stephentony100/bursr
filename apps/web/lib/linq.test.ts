import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LinqError, linqClient, usdcUnitsFromDecimal, verifyLinqSignature } from "./linq";

const USDC_STELLAR = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const client = linqClient({ baseUrl: "https://linq.test", apiKey: "k" });

function reply(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => vi.unstubAllGlobals());

describe("linq client", () => {
  it("sends the API key and reads the bank account's name", async () => {
    const f = reply(200, { accountName: "John Doe", bankName: "United Bank for Africa", accountNumber: "1234567890", bankCode: "033" });
    vi.stubGlobal("fetch", f);
    expect(await client.verifyBank("033", "1234567890")).toBe("John Doe");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://linq.test/b2b/verifybank");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("k");
    expect(JSON.parse(String(init.body))).toEqual({ bankCode: "033", accountNumber: "1234567890" });
  });

  it("creates a Stellar USDC cash-out and refuses an answer on another chain or asset", async () => {
    const good = { id: "o1", walletAddress: "GBQ7X2TESTADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", coinType: USDC_STELLAR, coin: "usdc", chain: "stellar", amountStableCoin: 5, amountNGN: 8275, rate: 1655, currency: "NGN", status: "initiated" };
    vi.stubGlobal("fetch", reply(201, good));
    const order = await client.createOfframp({ amountStableCoin: "5.00", bankAccount: "1234567890", bankCode: "033", bankName: "UBA", accountName: "John Doe", refundAddress: "GFEE", customerRef: "b1", idempotencyKey: "ord_1" });
    expect(order.id).toBe("o1");
    vi.stubGlobal("fetch", reply(201, { ...good, chain: "sui" }));
    await expect(client.createOfframp({ amountStableCoin: "5.00", bankAccount: "1", bankCode: "1", bankName: "x", accountName: "x", refundAddress: "G", customerRef: "b", idempotencyKey: "k" })).rejects.toThrow(/Stellar/);
    vi.stubGlobal("fetch", reply(201, { ...good, coinType: "USDC:GFAKEISSUER" }));
    await expect(client.createOfframp({ amountStableCoin: "5.00", bankAccount: "1", bankCode: "1", bankName: "x", accountName: "x", refundAddress: "G", customerRef: "b", idempotencyKey: "k" })).rejects.toThrow(/USDC/);
  });

  it("turns Linq's error message into a LinqError", async () => {
    vi.stubGlobal("fetch", reply(400, { message: "invalid bank code" }));
    await expect(client.verifyBank("999", "1234567890")).rejects.toEqual(new LinqError("invalid bank code", 400));
  });
});

describe("amounts", () => {
  it("reads Linq's decimal amounts into USDC units (7 decimals) without floats", () => {
    expect(usdcUnitsFromDecimal(1.22, 7)).toBe(12_200_000n);
    expect(usdcUnitsFromDecimal(50, 7)).toBe(500_000_000n);
    expect(usdcUnitsFromDecimal("0.1", 7)).toBe(1_000_000n);
    expect(() => usdcUnitsFromDecimal(1e-8, 7)).toThrow();
  });
});

describe("webhook signature", () => {
  it("accepts Linq's sha256= HMAC of the raw body and nothing else", () => {
    const body = '{"event":"order.completed","orderId":"o1"}';
    const sig = "sha256=" + createHmac("sha256", "whsec").update(body).digest("hex");
    expect(verifyLinqSignature(body, sig, "whsec")).toBe(true);
    expect(verifyLinqSignature(body + " ", sig, "whsec")).toBe(false);
    expect(verifyLinqSignature(body, sig, "other")).toBe(false);
    expect(verifyLinqSignature(body, null, "whsec")).toBe(false);
  });
});

describe("naira in (B2B onramp)", () => {
  it("registers a business's person and submits their NIN once", async () => {
    const f = reply(200, { customerRef: "b1", verified: false, created: true });
    vi.stubGlobal("fetch", f);
    expect(await client.provisionCustomer({ customerRef: "b1", firstName: "Ada", lastName: "Obi", email: "ada@shop.ng", phone: "08012345678" })).toEqual({ verified: false });
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ customerRef: "b1", firstName: "Ada", lastName: "Obi", email: "ada@shop.ng", phone: "08012345678" });
    vi.stubGlobal("fetch", reply(200, { customerRef: "b1", verified: true, status: "verified" }));
    expect(await client.submitKyc("b1", "12345678901")).toBe(true);
  });

  it("reads the onramp rate (a bare number) and creates a USDC-on-Stellar onramp order", async () => {
    vi.stubGlobal("fetch", reply(200, 1356.15));
    expect(await client.onrampRate()).toBe(1356.15);
    const f = reply(200, { orderId: "on_1", customerRef: "b1", accountNumber: "9876543210", bankName: "Wema Bank", amountNgn: 8136.9, amountStableCoin: 6, fee: 50, expiresAt: "2026-10-01T02:38:40Z", status: "awaiting payment", accountName: "Linq Onramp Payment" });
    vi.stubGlobal("fetch", f);
    const o = await client.createOnramp({ customerRef: "b1", amountStableCoin: "6.00", walletAddress: "GFEE", rate: 1356.15 });
    expect(o.orderId).toBe("on_1");
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ customerRef: "b1", amountStableCoin: 6, currency: "NGN", walletAddress: "GFEE", rate: 1356.15, coin: { stellar: true } });
  });

  it("reads an onramp order's status", async () => {
    const f = reply(200, { orderId: "on_1", customerRef: "b1", status: "completed", amount: 6, amountNgn: 8136.9 });
    vi.stubGlobal("fetch", f);
    expect((await client.onrampStatus("b1", "on_1")).status).toBe("completed");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://linq.test/b2b/onramp/status?customerRef=b1&orderId=on_1");
  });
});
