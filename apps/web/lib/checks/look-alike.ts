import { lookAlikeOf } from "./names";
import { pass, type Check } from "./types";

/** "Ek0 Fresh Foods" pretending to be "Eko Fresh Foods": blocked, never paid. */
export const lookAlike: Check = (invoice, { payees }) => {
  const name = invoice.extracted.supplierName;
  const real = lookAlikeOf(name, payees);
  if (!real) return pass("look-alike");
  return {
    check: "look-alike",
    status: "block",
    reason: `Name looks like ${real.name} but is not ${real.name} ("${name}"). Possible fraud: do not pay.`,
  };
};
