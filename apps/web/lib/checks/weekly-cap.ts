import { formatUsd } from "../money";
import { pass, type Check } from "./types";

/** Paying this would go over the weekly limit given what is already committed: move it to next week. */
export const weeklyCap: Check = (invoice, { rules, committedThisWeekUsd }) => {
  if (!invoice.amountsKnown) return pass("weekly-cap");
  const cap = BigInt(rules.weeklyCapUsd);
  if (committedThisWeekUsd + invoice.totalUsd <= cap) return pass("weekly-cap");
  const left = cap > committedThisWeekUsd ? cap - committedThisWeekUsd : 0n;
  return {
    check: "weekly-cap",
    status: "defer",
    reason: `Moved to next week: ${formatUsd(invoice.totalUsd)} is more than the ${formatUsd(left)} left under your weekly limit of ${formatUsd(cap)}.`,
  };
};
