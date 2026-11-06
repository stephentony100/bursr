import { formatUsd } from "../money";
import { exactPayee, normaliseName } from "./names";
import { pass, type Check } from "./types";

const DAY = 24 * 60 * 60 * 1000;
export const DUPLICATE_WINDOW_DAYS = 14;

const sameInvoiceNumber = (a: string, b: string) => a.replace(/[\s#-]/g, "").toLowerCase() === b.replace(/[\s#-]/g, "").toLowerCase();

/** Same supplier and invoice number, or same supplier and same total within 14 days. */
export const duplicate: Check = (invoice, { payees, history }) => {
  const { supplierName, invoiceNumber } = invoice.extracted;
  const payee = exactPayee(supplierName, payees);
  const sameSupplier = (h: (typeof history)[number]) =>
    payee ? h.payeeId === payee.id : normaliseName(h.supplierName) === normaliseName(supplierName);

  const byNumber = history.find((h) => sameSupplier(h) && sameInvoiceNumber(h.invoiceNumber, invoiceNumber));
  if (byNumber) {
    return {
      check: "duplicate",
      status: "hold",
      reason: `Possible duplicate of invoice #${byNumber.invoiceNumber} from ${supplierName}, received ${byNumber.receivedAt.toISOString().slice(0, 10)}.`,
    };
  }
  const byAmount = history.find(
    (h) =>
      sameSupplier(h) &&
      h.totalUsd === invoice.totalUsd &&
      Math.abs(invoice.receivedAt.getTime() - h.receivedAt.getTime()) <= DUPLICATE_WINDOW_DAYS * DAY,
  );
  if (byAmount) {
    return {
      check: "duplicate",
      status: "hold",
      reason: `Possible duplicate: invoice #${byAmount.invoiceNumber} from ${supplierName} was for the same ${formatUsd(invoice.totalUsd)} within ${DUPLICATE_WINDOW_DAYS} days.`,
    };
  }
  return pass("duplicate");
};
