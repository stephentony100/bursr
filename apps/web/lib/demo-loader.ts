import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "./generated/prisma/client";
import { ingestInvoice } from "./invoices";
import { SAMPLE_INVOICES } from "./sample-invoices";
import { readEnv } from "./env";
import { addPayee, setupBusiness } from "./owner-actions";
import { DEMO_OWNER_ID, demoOwner } from "./owner";
import { SAMPLE_NAME, sampleBalances, samplePayees, sampleRules } from "./sample";
import { getBusiness } from "./store";
import { payoutTokens } from "./tokens";

/**
 * Loads the sample restaurant (dry-run only). Replaces earlier demo data and
 * refuses to touch a database that belongs to a real (signed-in) owner.
 */
export async function loadSampleBusiness(db: PrismaClient) {
  if (readEnv().BURSAR_MODE !== "dry-run") throw new Error("The sample restaurant only loads in dry-run mode.");
  const existing = await getBusiness(db);
  if (existing && existing.ownerAccountId !== DEMO_OWNER_ID) {
    throw new Error(`The database belongs to ${existing.ownerAccountId}. Point DATABASE_URL at another file to load the demo.`);
  }
  await db.$transaction([
    db.telegramMessage.deleteMany(),
    db.planItem.deleteMany(),
    db.plan.deleteMany(),
    db.invoice.deleteMany(),
    db.accountAction.deleteMany(),
    db.auditEvent.deleteMany(),
    db.payee.deleteMany(),
    db.agentAccount.deleteMany(),
    db.business.deleteMany(),
  ]);
  const tokens = await payoutTokens();
  const rules = sampleRules(tokens);
  const owner = demoOwner();
  await setupBusiness(db, owner, { name: SAMPLE_NAME, rules, demoBalances: sampleBalances(rules) });
  const payees = samplePayees(tokens);
  for (const p of payees) await addPayee(db, owner, p);
  // Sample history: these suppliers and staff have been paid for months, so
  // they are not "new payees" that need their own approval tap.
  const longAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  // An established restaurant: everyone has been paid before, so routine payments need no extra OK.
  await db.payee.updateMany({ data: { addedAt: longAgo, trustedAt: longAgo } });
  const invoices = await loadSampleInvoices(db);
  return { name: SAMPLE_NAME, payees, invoices };
}

/** The six sample invoices, arriving over the last few hours in their fixed order. */
export async function loadSampleInvoices(db: PrismaClient, now = new Date()) {
  const dir = path.resolve(process.cwd(), "../../fixtures/invoices");
  const start = now.getTime() - 6 * 60 * 60 * 1000;
  const out = [];
  for (const s of SAMPLE_INVOICES) {
    const bytes = readFileSync(path.join(dir, s.file));
    out.push(await ingestInvoice(db, { name: s.file, mediaType: "image/png", bytes }, new Date(start + s.arrivesAfterMin * 60_000)));
  }
  return out;
}
