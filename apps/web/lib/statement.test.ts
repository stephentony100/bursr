import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentAccount } from "./agent-account";
import { loadSampleBusiness } from "./demo-loader";
import { approvePlan } from "./owner-actions";
import { demoOwner } from "./owner";
import { payApprovedPlan } from "./pay";
import { prepareWeeklyPlan } from "./plans";
import { amountOutFor, type quotePayout } from "./quotes";
import { statementCsv, statementLines, type StatementLine } from "./statement";
import { createTestDb } from "./test-db";

const t = createTestDb();
afterAll(() => t.close());

const fakeQuote: typeof quotePayout = async (_t, payout, usd) => {
  const out = amountOutFor(usd, payout.token).toString();
  return { ok: true, quote: { amountIn: out, minAmountIn: out, amountOut: out, withdrawFee: "0", timeEstimateSec: 5, at: new Date().toISOString() } };
};

let lines: StatementLine[];
beforeAll(async () => {
  await loadSampleBusiness(t.db);
  const plan = await prepareWeeklyPlan(t.db, new Date(), fakeQuote);
  await approvePlan(t.db, demoOwner(), plan.id);
  await payApprovedPlan(t.db, await agentAccount(t.db), plan.id, fakeQuote);
  lines = await statementLines(t.db);
}, 120_000);

describe("statement", () => {
  it("has one line per payment, with who approved it and the account's references", () => {
    expect(lines).toHaveLength(5);
    const farm = lines.find((l) => l.payee === "Mama Put Farms Ltd")!;
    expect(farm.forWhat).toBe("Invoice #MPF-0412");
    expect(farm.received).toBe("118");
    expect(farm.receivedAs).toMatch(/^USDC on NEAR to [0-9a-f]{64}$/);
    expect(farm.approval).toMatch(/^Plan approved by demo-owner\.near on /);
    expect(farm.references).toMatch(/^sim_/);
    expect(farm.status).toBe("Sent");
  });

  it("exports a CSV an accountant can open: a header, one row per payment, plain numbers", () => {
    const csv = statementCsv(lines);
    const rows = csv.trim().split("\r\n");
    expect(rows).toHaveLength(6);
    expect(rows[0]).toBe('"Date (UTC)","Payee","For","Amount (USD)","Sent from account","Payee received","Received as","Status","Approval","Plan","References","Note"');
    expect(csv).toContain('"Mama Put Farms Ltd","Invoice #MPF-0412","118.00"');
  });

  it("cannot be turned into a spreadsheet formula", () => {
    const evil = { ...lines[0], payee: '=HYPERLINK("http://x","y")' };
    expect(statementCsv([evil])).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
  });
});
