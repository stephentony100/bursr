import type { PrismaClient } from "./generated/prisma/client";
import { normaliseAddress, type Payee } from "./domain";
import { destinationFor } from "./policy";
import { getAccountRecord, getBusiness, listPayees } from "./store";

// Live mode: the owner's wallet signing someone into the agent's wallet is the
// strongest approval Bursr has, so it also counts as the "first payment"
// OK. People on the signed list are trusted; their first routine payment
// goes out on autopilot like any other. (Practice mode has no wallet
// signature, so there the owner's in-app OK still does this.)

const key = (d: { chain?: string; address: string; memo?: string | null }) => `${d.chain ?? "intents"}|${normaliseAddress(d.address)}|${d.memo ?? ""}`;

/** Marks payees on the owner's signed list as trusted and releases their payments that only waited for that. */
export async function trustSignedPayees(db: PrismaClient, now = new Date()): Promise<string[]> {
  const record = await getAccountRecord(db);
  const business = await getBusiness(db);
  if (!record || record.backend !== "agent-api" || !business) return [];
  const signed = new Set(((record.policy.destinations?.list ?? []) as { chain?: string; address: string; memo?: string | null }[]).map(key));
  const newlyTrusted: Payee[] = (await listPayees(db)).filter((p) => !p.trustedAt && signed.has(key(destinationFor(p))));
  if (newlyTrusted.length === 0) return [];
  const ids = newlyTrusted.map((p) => p.id);
  await db.payee.updateMany({ where: { id: { in: ids }, trustedAt: null }, data: { trustedAt: now } });
  // Payments that waited only because it was the first one (not because of their size) can go now.
  const waiting = await db.planItem.findMany({ where: { payeeId: { in: ids }, needsOwnTap: true, ownTapAt: null, payStatus: "planned" } });
  const threshold = BigInt(business.rules.approvalThresholdUsd);
  for (const item of waiting) {
    if (BigInt(item.amountUsd) <= threshold) await db.planItem.update({ where: { id: item.id }, data: { needsOwnTap: false, ownTapReason: null } });
  }
  return newlyTrusted.map((p) => p.name);
}
