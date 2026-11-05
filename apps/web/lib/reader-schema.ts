import { z } from "zod";

// What the Reader (NEAR AI Cloud) must return for one invoice. Amounts come
// back exactly as printed, as decimal strings; code converts them to integer
// smallest units. The model never does arithmetic for us, and anything it is
// unsure of is listed in `unsureFields` so the invoice goes to "needs owner".

const DecimalString = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "plain decimal number as printed, no symbols or commas");

export const ExtractedLineSchema = z.object({
  description: z.string().min(1),
  quantity: DecimalString,
  unitPrice: DecimalString,
  lineTotal: DecimalString,
});

export const ExtractedInvoiceSchema = z.object({
  supplierName: z.string().min(1),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().nullable().describe("YYYY-MM-DD as printed, or null"),
  dueDate: z.string().nullable().describe("YYYY-MM-DD as printed, or null"),
  currency: z.string().min(3).max(4).describe("ISO code as printed, e.g. USD"),
  lines: z.array(ExtractedLineSchema),
  total: DecimalString,
  payout: z
    .object({
      chain: z.string().nullable(),
      token: z.string().nullable(),
      address: z.string().nullable(),
    })
    .nullable()
    .describe("payment details printed on the invoice, if any"),
  urgencyNote: z.string().nullable().describe("any pressure or threat wording, quoted"),
  unsureFields: z.array(z.string()).describe("names of fields you could not read with certainty"),
});
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;
