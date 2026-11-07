import { formatUsd, parseUnits } from "../money";
import { pass, type Check } from "./types";

/** Each line's quantity × unit price must equal its line total, and the lines must add up to the total. */
export const arithmetic: Check = (invoice) => {
  if (!invoice.amountsKnown) return pass("arithmetic");
  const problems: string[] = [];
  for (const line of invoice.lines) {
    // quantity has up to 6 decimals; price × qty in micro-dollars, exact.
    const qtyMicro = parseUnits(line.quantity, 6);
    const expected = (line.unitPriceUsd * qtyMicro) / 1_000_000n;
    if (expected !== line.lineTotalUsd) {
      problems.push(`${line.description}: ${line.quantity} × ${formatUsd(line.unitPriceUsd)} is ${formatUsd(expected)}, not ${formatUsd(line.lineTotalUsd)}`);
    }
  }
  const sum = invoice.lines.reduce((a, l) => a + l.lineTotalUsd, 0n);
  if (invoice.lines.length > 0 && sum !== invoice.totalUsd) {
    problems.push(`the lines add up to ${formatUsd(sum)} but the total says ${formatUsd(invoice.totalUsd)}`);
  }
  if (problems.length === 0) return pass("arithmetic");
  return { check: "arithmetic", status: "hold", reason: `Arithmetic error: ${problems.join("; ")}.` };
};
