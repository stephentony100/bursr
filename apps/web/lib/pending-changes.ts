import { isDeepStrictEqual } from "node:util";
import { chainName } from "./chains";
import { normaliseAddress, PayoutSchema } from "./domain";
import type { PrismaClient } from "./generated/prisma/client";
import { formatUsd, parseUnits, rescale, USD_DECIMALS } from "./money";
import { buildPolicy } from "./policy";
import { getAccountRecord, getBusiness, listPayees } from "./store";

// Live mode: what the owner changed in Bursar that their wallet hasn't signed
// into the agent's wallet yet, in plain words. Removals and lower limits are
// already applied by Bursar itself (lib/pay.ts); additions and higher limits
// only take effect once the owner's wallet confirms.

export interface PendingChanges {
  lines: string[];
  /** Only removals or lower limits: nothing new becomes payable by confirming. */
  onlyTighter: boolean;
}

type Dest = { action: string; chain: string; address: string; memo: string | null };
const keyOf = (d: Dest) => `${d.chain}|${normaliseAddress(d.address)}|${d.memo ?? ""}`;
const short = (a: string) => (a.length > 16 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export async function pendingChanges(db: PrismaClient): Promise<PendingChanges | null> {
  const [business, record] = await Promise.all([getBusiness(db), getAccountRecord(db)]);
  if (!business || !record || record.backend !== "agent-api") return null;
  const payees = await listPayees(db);
  const want = buildPolicy(business.rules, payees);
  const have = record.policy;
  if (isDeepStrictEqual(want, have)) return null;

  const lines: string[] = [];
  let onlyTighter = true;
  // People: who's new on the list, who's gone.
  const removed = await db.payee.findMany({ where: { removedAt: { not: null } } });
  const nameFor = (d: Dest) => {
    const all = [...payees, ...removed.map((r) => ({ name: r.name, payout: PayoutSchema.parse(JSON.parse(r.payout)) }))];
    return all.find((p) => p.payout.token.chain === d.chain && normaliseAddress(p.payout.address) === normaliseAddress(d.address))?.name ?? short(d.address);
  };
  const wantDest = new Map((want.destinations.list as Dest[]).map((d) => [keyOf(d), d]));
  const haveDest = new Map(((have.destinations?.list ?? []) as Dest[]).map((d) => [keyOf(d), d]));
  for (const [k, d] of wantDest) {
    if (!haveDest.has(k)) {
      lines.push(`Add ${nameFor(d)} (paid on ${chainName(d.chain)})`);
      onlyTighter = false;
    }
  }
  for (const [k, d] of haveDest) if (!wantDest.has(k)) lines.push(`Remove ${nameFor(d)}`);

  const peopleLines = lines.length;
  // Limits.
  const weekly = (p: typeof want) => (p.budget?.weekly_usd ? parseUnits(p.budget.weekly_usd, USD_DECIMALS) : null);
  const [wNew, wOld] = [weekly(want), weekly(have)];
  if (wNew !== wOld) {
    lines.push(`Weekly limit ${wOld === null ? "none" : formatUsd(wOld)} → ${wNew === null ? "none" : formatUsd(wNew)}`);
    if (wOld !== null && (wNew === null || wNew > wOld)) onlyTighter = false;
  }
  const t = business.rules.treasury;
  const cap = (p: typeof want) => {
    const raw = p.limits?.per_transaction?.[t.assetId];
    return raw ? rescale(BigInt(raw), t.decimals, USD_DECIMALS) : null;
  };
  const [cNew, cOld] = [cap(want), cap(have)];
  if (cNew !== cOld) {
    lines.push(`Largest single payment ${cOld === null ? "none" : formatUsd(cOld)} → ${cNew === null ? "none" : formatUsd(cNew)}`);
    if (cOld !== null && (cNew === null || cNew > cOld)) onlyTighter = false;
  }
  const list = (x: typeof want.assets | undefined): string[] => (Array.isArray(x) ? [...x].sort() : x === "any" ? ["any"] : []);
  const peopleChanged = peopleLines > 0;
  // The wallet's currencies follow its people, so only mention them when they changed on their own.
  if (!isDeepStrictEqual(list(want.assets), list(have.assets)) && !peopleChanged) {
    lines.push("Which currencies people can be paid in");
    if (list(want.assets).some((a) => !list(have.assets).includes(a))) onlyTighter = false;
  }
  if (want.frozen !== have.frozen) lines.push(want.frozen ? "Pause all payments" : "Turn payments back on");
  if (lines.length === 0) lines.push("Other settings");
  return { lines, onlyTighter };
}
