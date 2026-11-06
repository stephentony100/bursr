import { exactPayee, lookAlikeOf } from "./names";
import { pass, type Check } from "./types";

/** The supplier must be one of the owner's payees. (A look-alike name is handled by look-alike.ts.) */
export const knownSupplier: Check = (invoice, { payees }) => {
  const name = invoice.extracted.supplierName;
  if (exactPayee(name, payees)) return pass("known-supplier");
  if (lookAlikeOf(name, payees)) return pass("known-supplier"); // reported as a block by look-alike
  return {
    check: "known-supplier",
    status: "hold",
    reason: `Unknown supplier: "${name}" is not on your payee list. Add them first if you want to pay them.`,
  };
};
