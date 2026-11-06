import type { PrismaClient } from "./generated/prisma/client";
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
  return { name: SAMPLE_NAME, payees };
}
