import { randomUUID } from "node:crypto";
import type { AgentAccount } from "./agent-account";
import type { PrismaClient } from "./generated/prisma/client";
import { formatUsd, rescale, USD_DECIMALS } from "./money";
import { canReceiveOnNear, notRegisteredText } from "./near-storage";
import { isOwnerSession, type OwnerSession } from "./owner";
import { NotOwnerError } from "./owner-actions";
import { settle } from "./pay";
import { getBusiness } from "./store";

// "Move money back to my wallet": the owner takes money out of the Bursr
// wallet. The Agent API has no owner withdrawal: money leaves only through the
// agent's own withdraw, inside the owner's signed rules ("Have the owner
// withdraw all funds first, for example by asking the agent to do it":
// docs.agentsonintents.com …/owner-signing). So it goes only to the owner's own
// NEAR account (on the list they sign), in parts no bigger than their largest
// single payment, and counts toward the weekly limit like any payment.

export interface HomeView {
  accountId: string;
  /** Treasury money in the Bursr wallet, USD (6 decimals). */
  balanceUsd: bigint;
  /** What can go back right now. */
  canMoveUsd: bigint;
  /** Why it's less than the balance, in plain words. */
  limitedBy: string | null;
}

export async function homeView(db: PrismaClient, account: AgentAccount): Promise<HomeView | null> {
  const business = await getBusiness(db);
  if (!business) return null;
  const t = business.rules.treasury;
  const s = await account.status();
  const balanceUsd = rescale(s.balances[t.assetId] ?? 0n, t.decimals, USD_DECIMALS);
  const weekLeft = BigInt(business.rules.weeklyCapUsd) - s.spentThisWeekUsd;
  const left = weekLeft > 0n ? weekLeft : 0n;
  let canMoveUsd = balanceUsd < left ? balanceUsd : left;
  let limitedBy: string | null = null;
  if (s.frozen || business.rules.frozen) {
    canMoveUsd = 0n;
    limitedBy = "Payments are paused. Turn them back on to move money.";
  } else if (left < balanceUsd) {
    limitedBy = `Your weekly limit has ${formatUsd(left)} left${s.weekResetsAt ? ` until ${s.weekResetsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}` : ""}. Raise it on the Limits page to move more.`;
  }
  return { accountId: business.ownerAccountId, balanceUsd, canMoveUsd, limitedBy };
}

/** Checks the request and starts moving the money. Returns at once; the feed shows each part. */
export async function moveMoneyHome(
  db: PrismaClient,
  owner: OwnerSession,
  account: AgentAccount,
  amountUsd: bigint | "all",
): Promise<{ amountUsd: bigint; parts: number; done: Promise<void> }> {
  if (!isOwnerSession(owner)) throw new NotOwnerError();
  const business = await getBusiness(db);
  if (!business || business.ownerAccountId !== owner.accountId) throw new NotOwnerError();
  const view = (await homeView(db, account))!;
  const want = amountUsd === "all" ? view.canMoveUsd : amountUsd;
  if (want <= 0n) throw new Error(view.limitedBy ?? "There's no money in your Bursr wallet to move.");
  if (want > view.balanceUsd) throw new Error(`Your Bursr wallet has ${formatUsd(view.balanceUsd)}.`);
  if (want > view.canMoveUsd) throw new Error(`You can move up to ${formatUsd(view.canMoveUsd)} now. ${view.limitedBy ?? ""}`.trim());

  const t = business.rules.treasury;
  if (account.backend === "agent-api" && t.chain === "near") {
    const ok = await canReceiveOnNear(t.assetId, owner.accountId);
    if (ok === false) throw new Error(notRegisteredText(owner.accountId, t.symbol));
  }

  // Parts no bigger than the largest single payment: the wallet refuses anything bigger.
  const cap = BigInt(business.rules.perPaymentCapUsd);
  const parts: bigint[] = [];
  for (let rest = want; rest > 0n; rest -= rest > cap ? cap : rest) parts.push(rest > cap ? cap : rest);

  const runId = randomUUID();
  await db.auditEvent.create({
    data: {
      kind: "home_started",
      actor: owner.accountId,
      message: `You asked to move ${formatUsd(want)} back to your wallet (${owner.accountId})${parts.length > 1 ? `, in ${parts.length} parts because of your largest single payment` : ""}.`,
      data: JSON.stringify({ runId, parts: parts.map(String) }),
    },
  });

  const done = (async () => {
    let moved = 0n;
    for (const [i, part] of parts.entries()) {
      const say = (kind: string, message: string) => db.auditEvent.create({ data: { kind, actor: "agent", message, data: JSON.stringify({ runId, part: i }) } });
      try {
        const r = await account.execute(
          { kind: "withdraw", asset: t.assetId, amount: rescale(part, USD_DECIMALS, t.decimals), chain: t.chain, recipient: owner.accountId, memo: null },
          `home:${runId}:${i}`,
        );
        if (r.status === "refused") {
          await say("home_failed", `Couldn't move ${formatUsd(part)} back to your wallet: ${r.refusal.message} Nothing was sent.`);
          break;
        }
        // One money action at a time per wallet: wait for this part before the next.
        const o = r.simulated ? { state: "done" as const } : await settle(account, r.correlationId);
        if (o.state === "pending") {
          await say("home_pending", `Moving ${formatUsd(part)} back to your wallet is taking longer than usual. Check the feed on This week before trying again.`);
          break;
        }
        if (o.state !== "done") {
          await say("home_failed", `Moving ${formatUsd(part)} back to your wallet didn't go through${o.reason ? ` (${o.reason})` : ""}. The money is still in your Bursr wallet.`);
          break;
        }
        moved += part;
      } catch (e) {
        await say("home_failed", `Moving ${formatUsd(part)} back to your wallet stopped (${e instanceof Error ? e.message : String(e)}). Check your wallet and the feed before trying again.`);
        break;
      }
    }
    if (moved > 0n) {
      await db.auditEvent.create({
        data: { kind: "home_done", actor: "agent", message: `Moved ${formatUsd(moved)} back to your wallet (${owner.accountId}).`, data: JSON.stringify({ runId }) },
      });
    }
  })();
  return { amountUsd: want, parts: parts.length, done };
}
