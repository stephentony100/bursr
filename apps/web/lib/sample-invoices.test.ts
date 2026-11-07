import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadSampleBusiness } from "./demo-loader";
import type { InvoiceView } from "./invoices";
import { SAMPLE_INVOICES } from "./sample-invoices";
import { createTestDb } from "./test-db";

// M2 "done when": running the sample invoices produces exactly the expected
// holds/blocks with the expected reasons.

const t = createTestDb();
afterAll(() => t.close());

let invoices: InvoiceView[];
beforeAll(async () => {
  invoices = (await loadSampleBusiness(t.db)).invoices;
}, 120_000);

describe("the six sample invoices", () => {
  it.each(SAMPLE_INVOICES.map((s) => [s.file, s]))("%s gives the expected result", (file, s) => {
    const inv = invoices.find((i) => i.fileName === file)!;
    expect(inv.readBy).toMatch(/Practice mode|NEAR AI Cloud/);
    expect(inv.status).toBe(s.expected.status);
    // Every expected problem is found. A real AI reading may add warnings
    // (e.g. a misread address is flagged), but never another hold or block.
    const found = inv.results.filter((r) => r.status !== "pass");
    expect(found.map((r) => r.check)).toEqual(expect.arrayContaining(s.expected.problems));
    expect(found.filter((r) => !s.expected.problems.includes(r.check)).every((r) => r.status === "flag")).toBe(true);
  });

  it("gives the reasons in plain words", () => {
    const reason = (file: string, check: string) => invoices.find((i) => i.fileName === file)!.results.find((r) => r.check === check)!.reason;
    expect(reason("03-ek0-fresh-foods-EFF-7781.png", "look-alike")).toMatch(/^Name looks like Eko Fresh Foods but is not Eko Fresh Foods/);
    expect(reason("04-mama-put-farms-MPF-0412-again.png", "duplicate")).toMatch(/^Possible duplicate of invoice #MPF-0412/);
    expect(reason("05-eko-fresh-foods-EFF-7790.png", "payout-changed")).toMatch(/^Payout details changed/);
    expect(reason("05-eko-fresh-foods-EFF-7790.png", "urgency")).toContain("Pay today or your supply will be stopped.");
    expect(reason("06-mama-put-farms-MPF-0419.png", "overpriced")).toBe("Tomatoes (crate) billed at $23.40, agreed $18.00 (30% more).");
  });

  it("two supplier invoices are ready to pay, four have problems (PRD §9)", () => {
    expect(invoices.filter((i) => i.status === "ready")).toHaveLength(2);
    expect(invoices.filter((i) => ["hold", "block"].includes(i.status))).toHaveLength(4);
  });

  it("an unknown image in practice mode without a key goes to the owner, never guessed", async () => {
    const { ingestInvoice } = await import("./invoices");
    const v = await ingestInvoice(t.db, { name: "photo.png", mediaType: "image/png", bytes: Buffer.from("not a sample") });
    expect(v.status).toBe("needs_owner");
    expect(v.needsOwner).toContain("needs NEAR AI Cloud");
  });
});
