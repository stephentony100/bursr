import { addressProblem } from "../address";
import { normaliseAddress } from "../domain";
import { exactPayee } from "./names";
import { pass, type Check } from "./types";

/**
 * Payment details printed on the invoice must match the payee record. A
 * different address is the classic "our bank details changed" fraud: block,
 * and only the owner can change a payee's address (after calling them).
 *
 * An address that is not even valid for the payee's network as read (wrong
 * length, failed checksum) is a misreading, not a new address: the AI read
 * a long string slightly wrong. That is only a warning. Bursr never pays an
 * address taken from an invoice; it pays the address on record.
 */
export const payoutChanged: Check = (invoice, { payees }) => {
  const printed = invoice.extracted.payout?.address?.trim();
  const payee = exactPayee(invoice.extracted.supplierName, payees);
  if (!printed || !payee) return pass("payout-changed");
  if (normaliseAddress(printed) === normaliseAddress(payee.payout.address)) return pass("payout-changed");
  if (addressProblem(payee.payout.token.chain, printed)) {
    return {
      check: "payout-changed",
      status: "flag",
      reason: `Bursr couldn't read the payment address on this invoice clearly. No problem: Bursr only ever pays ${payee.name} at the address you saved.`,
    };
  }
  return {
    check: "payout-changed",
    status: "block",
    reason: `Payment details changed: this invoice asks you to pay ${printed}, but you pay ${payee.name} at ${payee.payout.address}. Call ${payee.name} on a number you already trust before changing anything.`,
  };
};
