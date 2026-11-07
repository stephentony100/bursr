import { prepareForChecks, runChecks, type CheckResult, type InvoiceStatus, type PastInvoice } from "./checks";
import { exactPayee } from "./checks/names";
import type { PrismaClient } from "./generated/prisma/client";
import { ExtractedInvoiceSchema, type ExtractedInvoice } from "./reader-schema";
import { readInvoice, sha256, type InvoiceFile } from "./reader";
import { getBusiness, listPayees } from "./store";

// Invoices in: read → convert to integers (or "needs owner") → run every check
// against the payee list and earlier invoices → store the verdict. This is
// agent-side code: it reads payees but can never change them.

export interface InvoiceView {
  id: string;
  receivedAt: Date;
  fileName: string;
  readBy: string;
  status: InvoiceStatus;
  supplierName: string;
  invoiceNumber: string;
  totalUsd: bigint;
  payeeId: string | null;
  results: CheckResult[];
  needsOwner: string | null;
  extracted: ExtractedInvoice | null;
}

type Row = Awaited<ReturnType<PrismaClient["invoice"]["findMany"]>>[number];

export function invoiceFromRow(r: Row): InvoiceView {
  return {
    id: r.id,
    receivedAt: r.receivedAt,
    fileName: r.fileName,
    readBy: r.readBy,
    status: r.status as InvoiceStatus,
    supplierName: r.supplierName,
    invoiceNumber: r.invoiceNumber,
    totalUsd: BigInt(r.totalUsd),
    payeeId: r.payeeId,
    results: JSON.parse(r.results) as CheckResult[],
    needsOwner: r.needsOwner,
    extracted: r.extracted ? ExtractedInvoiceSchema.parse(JSON.parse(r.extracted)) : null,
  };
}

export async function listInvoices(db: PrismaClient): Promise<InvoiceView[]> {
  const rows = await db.invoice.findMany({ orderBy: { receivedAt: "desc" } });
  return rows.map(invoiceFromRow);
}

async function history(db: PrismaClient): Promise<PastInvoice[]> {
  const rows = await db.invoice.findMany({ where: { extracted: { not: null } }, select: { id: true, payeeId: true, supplierName: true, invoiceNumber: true, totalUsd: true, receivedAt: true } });
  return rows.map((r) => ({ ...r, totalUsd: BigInt(r.totalUsd) }));
}

export async function ingestInvoice(db: PrismaClient, file: InvoiceFile, receivedAt = new Date()): Promise<InvoiceView> {
  const business = await getBusiness(db);
  if (!business) throw new Error("Set up the business first.");
  const base = { receivedAt, fileName: file.name, mediaType: file.mediaType, fileHash: sha256(file.bytes), file: new Uint8Array(file.bytes) };

  const read = await readInvoice(file);
  if (!read.ok) {
    const row = await db.invoice.create({ data: { ...base, readBy: read.readBy, status: "needs_owner", needsOwner: read.reason } });
    return invoiceFromRow(row);
  }

  const payees = await listPayees(db);
  const payee = exactPayee(read.extracted.supplierName, payees);
  const common = {
    ...base,
    readBy: read.readBy,
    chatId: read.chatId ?? null,
    extracted: JSON.stringify(read.extracted),
    supplierName: read.extracted.supplierName,
    invoiceNumber: read.extracted.invoiceNumber,
    payeeId: payee?.id ?? null,
  };

  const prepared = prepareForChecks("new", read.extracted, receivedAt);
  // The weekly limit is applied again when the plan is built (M3); here nothing is committed yet.
  const verdict = runChecks(
    prepared.invoice,
    { payees, history: await history(db), rules: business.rules, committedThisWeekUsd: 0n },
    prepared.needsOwner,
  );
  const row = await db.invoice.create({
    data: {
      ...common,
      totalUsd: prepared.invoice.totalUsd.toString(),
      status: verdict.status,
      results: JSON.stringify(verdict.results),
      needsOwner: prepared.needsOwner,
    },
  });
  return invoiceFromRow(row);
}
