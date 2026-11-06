import { formatUsd } from "../money";
import { exactPayee, normaliseName } from "./names";
import { pass, type Check } from "./types";

/** Each line's unit price against the agreed price list, with the payee's tolerance. */
export const overpriced: Check = (invoice, { payees }) => {
  const payee = exactPayee(invoice.extracted.supplierName, payees);
  if (!payee || payee.prices.length === 0) return pass("overpriced");
  const problems: string[] = [];
  for (const line of invoice.lines) {
    const agreed = payee.prices.find((p) => normaliseName(p.item) === normaliseName(line.description));
    if (!agreed) continue;
    const agreedUsd = BigInt(agreed.unitPriceUsd);
    const limit = agreedUsd + (agreedUsd * BigInt(agreed.toleranceBps)) / 10_000n;
    if (line.unitPriceUsd > limit) {
      const pct = ((line.unitPriceUsd - agreedUsd) * 100n) / agreedUsd;
      problems.push(`${agreed.item} billed at ${formatUsd(line.unitPriceUsd)}, agreed ${formatUsd(agreedUsd)} (${pct}% more)`);
    }
  }
  if (problems.length === 0) return pass("overpriced");
  return { check: "overpriced", status: "hold", reason: `${problems.join("; ")}.` };
};
