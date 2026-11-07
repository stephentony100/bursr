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
 * a long string slightly wrong. That is only a warning. Bursar never pays an
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
      reason: `The payment address on the invoice could not be read exactly ("${printed}" is not a valid address). Bursar only ever pays ${payee.name} at the address on record, ${payee.payout.address}.`,
    };
  }
  return {
    check: "payout-changed",
    status: "block",
    reason: `Payout details changed: the invoice asks for payment to ${printed}, but ${payee.name} is paid at ${payee.payout.address}. Confirm with ${payee.name} by phone before changing anything.`,
  };
};
