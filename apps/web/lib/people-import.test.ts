import { describe, expect, it } from "vitest";
import { parseCsv, readImport, tokenFromWords } from "./people-import";
import { USDC_NEAR, USDT_TRON } from "./test-fixtures";
import { demoTronAddress } from "./demo-addresses";

const tokens = [USDC_NEAR, USDT_TRON];

describe("adding people from a spreadsheet", () => {
  it("reads quoted cells, semicolons and Windows line endings", () => {
    expect(parseCsv('Name,Paid in\r\n"Eze, Amaka",USDC on NEAR\r\n')).toEqual([
      ["Name", "Paid in"],
      ["Eze, Amaka", "USDC on NEAR"],
    ]);
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("matches the way people write networks", () => {
    expect(tokenFromWords("USDT on Tron", tokens)?.assetId).toBe(USDT_TRON.assetId);
    expect(tokenFromWords("usdc near", tokens)?.assetId).toBe(USDC_NEAR.assetId);
    expect(tokenFromWords("BTC", tokens)).toBeNull();
  });

  it("checks every row and says what's wrong in plain words", () => {
    const tron = demoTronAddress("farm");
    const csv = [
      "Name,Type,Regular pay,Every,Paid in,Wallet address,Memo",
      "Amaka Eze,staff,120,week,USDC on NEAR,amaka.near,",
      `Tomato Farm,supplier,,,USDT on Tron,${tron},`,
      "Bad Address,staff,50,week,USDT on Tron,not-an-address,",
      "Wrong Network,staff,50,week,USDC on Base,0x1234,",
      "Odd Pay,staff,lots,week,USDC on NEAR,odd.near,",
      ",staff,10,week,USDC on NEAR,x.near,",
    ].join("\n");
    const { rows, problem } = readImport(csv, tokens);
    expect(problem).toBeNull();
    expect(rows.map((r) => Boolean(r.input))).toEqual([true, true, false, false, false, false]);
    expect(rows[0].input).toMatchObject({ name: "Amaka Eze", category: "staff", recurring: { amountUsd: "120000000", every: "week" } });
    expect(rows[1].input).toMatchObject({ category: "supplier", recurring: null });
    expect(rows[1].summary).toMatch(/paid by invoice/);
    expect(rows[3].problem).toMatch(/isn't a way your rules allow/);
    expect(rows[4].problem).toMatch(/amount like 120/);
    expect(rows[5].problem).toBe("No name.");
  });

  it("explains missing headings", () => {
    expect(readImport("Who,Where\nA,B", tokens).problem).toMatch(/Name, Paid in and Wallet address/);
  });
});
