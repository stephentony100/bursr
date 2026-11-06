import { describe, expect, it } from "vitest";
import { duplicate } from "./duplicate";
import { ctx, inv, past } from "./test-helpers";

describe("duplicate", () => {
  it("holds the same supplier and invoice number", () => {
    const r = duplicate(inv({ invoiceNumber: "MPF-0412" }), ctx({ history: [past({ invoiceNumber: "MPF 0412" })] }));
    expect(r.status).toBe("hold");
    expect(r.reason).toContain("Possible duplicate of invoice #MPF 0412");
  });

  it("holds the same supplier and total within 14 days", () => {
    const r = duplicate(inv({ invoiceNumber: "MPF-0500" }), ctx({ history: [past({ totalUsd: 93_000_000n })] }));
    expect(r.status).toBe("hold");
    expect(r.reason).toContain("same $93.00 within 14 days");
  });

  it("passes the same total more than 14 days apart (a regular order)", () => {
    const old = past({ totalUsd: 93_000_000n, receivedAt: new Date("2026-10-20T09:00:00Z") });
    expect(duplicate(inv({ invoiceNumber: "MPF-0500" }), ctx({ history: [old] })).status).toBe("pass");
  });

  it("passes the same invoice number from a different supplier", () => {
    const other = past({ payeeId: "eko", supplierName: "Eko Fresh Foods", invoiceNumber: "MPF-0412" });
    expect(duplicate(inv({ invoiceNumber: "MPF-0412" }), ctx({ history: [other] })).status).toBe("pass");
  });

  it("passes a new invoice with a different number and total", () => {
    expect(duplicate(inv({ invoiceNumber: "MPF-0413" }), ctx({ history: [past()] })).status).toBe("pass");
  });
});
