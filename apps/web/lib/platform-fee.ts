import type { PrismaClient } from "./generated/prisma/client";
import { getBusiness } from "./store";
import { readEnv } from "./env";
import { findPayoutToken, payoutTokens } from "./tokens";

// Bursr's own fee is the platform's term, set by whoever runs Bursr
// (BURSAR_FEE_BPS, BURSAR_FEE_ACCOUNT_ID), not by the agent. A business set up
// before the fee was switched on gets it here, once, with a line in its feed.
// The fee address is on the list the owner's wallet signs like any payee, so
// the agent's wallet refuses any other fee address.

export async function applyPlatformFee(db: PrismaClient): Promise<boolean> {
  const env = readEnv();
  if (env.BURSAR_MODE !== "live" || env.BURSAR_FEE_BPS <= 0 || !env.BURSAR_FEE_ACCOUNT_ID) return false;
  const business = await getBusiness(db);
  if (!business) return false;
  const current = business.rules.fee;
  if (current && current.bps === env.BURSAR_FEE_BPS && current.payout.address === env.BURSAR_FEE_ACCOUNT_ID) return false;
  const token = findPayoutToken(await payoutTokens(), "USDC", "near");
  const fee = { bps: env.BURSAR_FEE_BPS, payout: { token, address: env.BURSAR_FEE_ACCOUNT_ID, memo: null } };
  await db.business.update({ where: { id: business.id }, data: { rules: JSON.stringify({ ...business.rules, fee }) } });
  const pct = (fee.bps / 100).toFixed(2).replace(/\.?0+$/, "");
  await db.auditEvent.create({
    data: {
      kind: "fee_terms",
      actor: "agent",
      message: `Bursr's fee is ${pct}% of each payment run. It shows as its own line on Payments, and you can see it on Spending rules.`,
      data: JSON.stringify({ bps: fee.bps }),
    },
  });
  return true;
}
