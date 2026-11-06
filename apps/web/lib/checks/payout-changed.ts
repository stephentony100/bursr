import { normaliseAddress } from "../domain";
import { exactPayee } from "./names";
import { pass, type Check } from "./types";

/**
 * Payment details printed on the invoice must match the payee record. A
 * different address is the classic "our bank details changed" fraud: block,
 * and only the owner can change a payee's address (after calling them).
 */
export const payoutChanged: Check = (invoice, { payees }) => {
  const printed = invoice.extracted.payout?.address?.trim();
  const payee = exactPayee(invoice.extracted.supplierName, payees);
  if (!printed || !payee) return pass("payout-changed");
  if (normaliseAddress(printed) === normaliseAddress(payee.payout.address)) return pass("payout-changed");
  return {
    check: "payout-changed",
    status: "block",
    reason: `Payout details changed: the invoice asks for payment to ${printed}, but ${payee.name} is paid at ${payee.payout.address}. Confirm with ${payee.name} by phone before changing anything.`,
  };
};
