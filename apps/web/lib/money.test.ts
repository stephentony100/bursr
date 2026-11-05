import { describe, expect, it } from "vitest";
import { formatUnits, formatUsd, fromStr, parseUnits, rescale } from "./money";

describe("money", () => {
  it("parses decimal text into integer smallest units", () => {
    expect(parseUnits("12.5", 6)).toBe(12_500_000n);
    expect(parseUnits("0.000001", 6)).toBe(1n);
    expect(parseUnits("118", 6)).toBe(118_000_000n);
  });

  it("refuses ambiguous or over-precise text instead of guessing", () => {
    expect(() => parseUnits("1,000.00", 6)).toThrow();
    expect(() => parseUnits("$12", 6)).toThrow();
    expect(() => parseUnits("1.0000001", 6)).toThrow();
    expect(() => parseUnits("-1", 6)).toThrow();
    expect(() => parseUnits("1e3", 6)).toThrow();
  });

  it("formats without losing precision", () => {
    expect(formatUnits(12_500_000n, 6)).toBe("12.5");
    expect(formatUnits(1n, 6)).toBe("0.000001");
    expect(formatUnits(0n, 6)).toBe("0");
    expect(formatUsd(1_234_500_000n)).toBe("$1,234.50");
  });

  it("rescales between precisions", () => {
    expect(rescale(1_000_000n, 6, 18)).toBe(10n ** 18n);
    expect(rescale(10n ** 18n + 1n, 18, 6)).toBe(1_000_000n);
  });

  it("only accepts integer strings from storage", () => {
    expect(fromStr("42")).toBe(42n);
    expect(() => fromStr("4.2")).toThrow();
  });
});
