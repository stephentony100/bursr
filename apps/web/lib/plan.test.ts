import { describe, expect, it } from "vitest";
import type { InvoiceView } from "./invoices";
import { buildPlan, type PlanInput } from "./plan";
import { payee, rules, usd } from "./test-fixtures";

const NOW = new Date("2026-11-06T10:00:00Z"); // a Friday, 6th of the month
const OLD = "2026-09-01T00:00:00.000Z";

const farm = payee({ id: "farm", name: "Mama Put Farms Ltd", addedAt: OLD });
const chef = payee({ id: "chef", name: "Bisi", category: "staff", addedAt: OLD, recurring: { amountUsd: usd(220), every: "week" } });
const cashier = payee({ id: "cashier", name: "Amaka", category: "staff", addedAt: OLD, recurring: { amountUsd: usd(300), every: "month" } });

function invoice(over: Partial<InvoiceView> & { id: string }): InvoiceView {
  return {
    receivedAt: NOW,
    fileName: "x.png",
    readBy: "test",
    status: "ready",
    supplierName: "Mama Put Farms Ltd",
    invoiceNumber: over.id.toUpperCase(),
    totalUsd: BigInt(usd(100)),
    payeeId: "farm",
    results: [],
    needsOwner: null,
    extracted: null,
    ...over,
  };
}

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    invoices: [],
    payees: [farm, chef],
    rules: rules(), // weekly $1,000, per payment $400, ask first above $250
    spentThisWeekUsd: 0n,
    handledInvoiceIds: new Set(),
    wagesPaidPayeeIds: new Set(),
    now: NOW,
    ...over,
  };
}

const placement = (plan: ReturnType<typeof buildPlan>, forWhat: string) => plan.items.find((i) => i.forWhat === forWhat)!;

describe("weekly plan", () => {
  it("puts staff pay and ready invoices in the plan, staff first", () => {
    const plan = buildPlan(input({ invoices: [invoice({ id: "a" })] }));
    expect(plan.items.map((i) => [i.forWhat, i.placement])).toEqual([
      ["Weekly pay", "in"],
      ["Invoice #A", "in"],
    ]);
    expect(plan.inTotalUsd).toBe(BigInt(usd(320)));
  });

  it("lists held and blocked invoices with their reasons, never in the plan", () => {
    const blocked = invoice({
      id: "b",
      status: "block",
      results: [{ check: "look-alike", status: "block", reason: "Name looks like X but is not X." }],
    });
    const item = placement(buildPlan(input({ invoices: [blocked] })), "Invoice #B");
    expect(item.placement).toBe("held");
    expect(item.reason).toBe("Name looks like X but is not X.");
  });

  it("shows a block reason before a 'needs you' note", () => {
    const both = invoice({
      id: "h",
      status: "block",
      needsOwner: "The reader was not sure about: supplierName.",
      results: [{ check: "payout-changed", status: "block", reason: "Payout details changed." }],
    });
    expect(placement(buildPlan(input({ invoices: [both] })), "Invoice #H").reason).toBe(
      "Payout details changed. The reader was not sure about: supplierName.",
    );
  });

  it("an AI warning alone does not keep a ready invoice out", () => {
    const flagged = invoice({ id: "f", status: "flag", results: [{ check: "urgency", status: "flag", reason: "x" }] });
    expect(placement(buildPlan(input({ invoices: [flagged] })), "Invoice #F").placement).toBe("in");
  });

  it("defers what does not fit under the weekly limit", () => {
    const plan = buildPlan(input({ spentThisWeekUsd: BigInt(usd(700)), invoices: [invoice({ id: "a", totalUsd: BigInt(usd(100)) })] }));
    // $300 left: wages $220 fit, the $100 invoice does not.
    expect(placement(plan, "Weekly pay").placement).toBe("in");
    const a = placement(plan, "Invoice #A");
    expect(a.placement).toBe("deferred");
    expect(a.reason).toContain("only $80.00 is left");
  });

  it("holds anything above the largest single payment (the account would refuse it)", () => {
    const item = placement(buildPlan(input({ invoices: [invoice({ id: "big", totalUsd: BigInt(usd(401)) })] })), "Invoice #BIG");
    expect(item.placement).toBe("held");
    expect(item.reason).toContain("above your largest single payment of $400.00");
  });

  it("asks for the owner's own tap above the threshold", () => {
    const item = placement(buildPlan(input({ invoices: [invoice({ id: "c", totalUsd: BigInt(usd(300)) })] })), "Invoice #C");
    expect(item.placement).toBe("in");
    expect(item.needsOwnTap).toBe(true);
    expect(item.ownTapReason).toContain("above $250.00");
  });

  it("asks for the owner's own tap for a payee added in the last 7 days", () => {
    const fresh = { ...farm, addedAt: "2026-11-04T00:00:00.000Z" };
    const item = placement(buildPlan(input({ payees: [fresh], invoices: [invoice({ id: "d" })] })), "Invoice #D");
    expect(item.needsOwnTap).toBe(true);
    expect(item.ownTapReason).toContain("new payee");
  });

  it("does not ask for a tap for an established payee under the threshold", () => {
    expect(placement(buildPlan(input({ invoices: [invoice({ id: "e" })] })), "Invoice #E").needsOwnTap).toBe(false);
  });

  it("holds payments to a payee whose payout details changed in the last 48 hours", () => {
    const changed = { ...farm, payoutChangedAt: "2026-11-05T12:00:00.000Z" };
    const item = placement(buildPlan(input({ payees: [changed], invoices: [invoice({ id: "g" })] })), "Invoice #G");
    expect(item.placement).toBe("held");
    expect(item.reason).toContain("on hold until");
  });

  it("skips invoices already paid and wages already paid this period", () => {
    const plan = buildPlan(input({ invoices: [invoice({ id: "a" })], handledInvoiceIds: new Set(["a"]), wagesPaidPayeeIds: new Set(["chef"]) }));
    expect(plan.items).toHaveLength(0);
  });

  it("monthly pay only on the first payday of the month", () => {
    expect(placement(buildPlan(input({ payees: [cashier] })), "Monthly pay").placement).toBe("in");
    expect(buildPlan(input({ payees: [cashier], now: new Date("2026-11-13T10:00:00Z") })).items).toHaveLength(0);
  });
});
