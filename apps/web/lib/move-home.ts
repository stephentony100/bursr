import { randomUUID } from "node:crypto";
import type { AgentAccount } from "./agent-account";
import { chainName } from "./chains";
import type { PrismaClient } from "./generated/prisma/client";
import { ownerHome } from "./home";
import { formatUsd, rescale, USD_DECIMALS } from "./money";
import { canReceiveOnNear, notRegisteredText } from "./near-storage";
import { isOwnerSession, type OwnerSession } from "./owner";
import { NotOwnerError } from "./owner-actions";
import { ownerLabel } from "./owner-id";
import { settle } from "./pay";
import { getBusiness } from "./store";

// "Move money back to my wallet": the owner takes money out of the Bursr
// wallet. The Agent API has no owner withdrawal: money leaves only through the
// agent's own withdraw, inside the owner's signed rules ("Have the owner
// withdraw all funds first, for example by asking the agent to do it":
// docs.agentsonintents.com …/owner-signing). So it goes only to the owner's own
// wallet ("home", lib/home.ts: worked out from their sign-in ID and on the list
// they sign), in parts no bigger than their largest single payment, and counts
// toward the weekly limit like any payment:
// - NEAR owner: the treasury token straight to their NEAR account;
// - Sui owner: exchanged into USDC on Sui inside the account, then sent to
//   their Sui address (two actions, so the weekly limit counts it twice, as for
//   payments on other networks).

export interface HomeView {
  /** How the owner's own wallet is shown (a NEAR account, or "Sui · 0x12…ab"). */
  label: string;
  /** Treasury money in the Bursr wallet, USD (6 decimals). */
  balanceUsd: bigint;
  /** What can go back right now. */
  canMoveUsd: bigint;
  /** Why it's less than the balance, in plain words. */
  limitedBy: string | null;
  /** The money is exchanged before it's sent (another network): fees come off what arrives. */
  exchanged: boolean;
}

export async function homeView(db: PrismaClient, account: AgentAccount): Promise<HomeView | null> {
  const business = await getBusiness(db);
  if (!business) return null;
  const home = await ownerHome(business.rules, business.ownerAccountId);
  if (!home) return null;
  const t = business.rules.treasury;
  const exchanged = home.token.assetId !== t.assetId;
  const s = await account.status();
  const balanceUsd = rescale(s.balances[t.assetId] ?? 0n, t.decimals, USD_DECIMALS);
  const weekLeft = BigInt(business.rules.weeklyCapUsd) - s.spentThisWeekUsd;
  // An exchange then a send: each counts toward the weekly limit.
  const left = weekLeft > 0n ? (exchanged ? weekLeft / 2n : weekLeft) : 0n;
  let canMoveUsd = balanceUsd < left ? balanceUsd : left;
  let limitedBy: string | null = null;
  if (s.frozen || business.rules.frozen) {
    canMoveUsd = 0n;
    limitedBy = "Payments are paused. Turn them back on to move money.";
  } else if (left < balanceUsd) {
    const until = s.weekResetsAt ? ` until ${s.weekResetsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}` : "";
    limitedBy = `Your weekly limit has room for ${formatUsd(left)}${exchanged ? " (moving to another network counts twice: the exchange, then the send)" : ""}${until}. Raise it on the Limits page to move more.`;
  }
  return { label: ownerLabel(business.ownerAccountId), balanceUsd, canMoveUsd, limitedBy, exchanged };
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
  // Always the owner's own wallet, from their sign-in ID.
  const home = await ownerHome(business.rules, owner.accountId);
  const view = await homeView(db, account);
  if (!home || !view) throw new Error("Bursr can't send money back to this kind of wallet yet.");
  const want = amountUsd === "all" ? view.canMoveUsd : amountUsd;
  if (want <= 0n) throw new Error(view.limitedBy ?? "There's no money in your Bursr wallet to move.");
  if (want > view.balanceUsd) throw new Error(`Your Bursr wallet has ${formatUsd(view.balanceUsd)}.`);
  if (want > view.canMoveUsd) throw new Error(`You can move up to ${formatUsd(view.canMoveUsd)} now. ${view.limitedBy ?? ""}`.trim());

  const t = business.rules.treasury;
  const out = home.token;
  if (account.backend === "agent-api" && home.chain === "near") {
    const ok = await canReceiveOnNear(out.assetId, home.address);
    if (ok === false) throw new Error(notRegisteredText(home.address, out.symbol));
  }

  // Parts no bigger than the largest single payment: the wallet refuses anything bigger.
  const cap = BigInt(business.rules.perPaymentCapUsd);
  const parts: bigint[] = [];
  for (let rest = want; rest > 0n; rest -= rest > cap ? cap : rest) parts.push(rest > cap ? cap : rest);

  const runId = randomUUID();
  const exchangeWords = view.exchanged ? `. It's exchanged into ${out.symbol} on ${chainName(out.chain)} first; exchange and network fees come off what arrives` : "";
  await db.auditEvent.create({
    data: {
      kind: "home_started",
      actor: owner.accountId,
      message: `You asked to move ${formatUsd(want)} back to your wallet (${view.label})${parts.length > 1 ? `, in ${parts.length} parts because of your largest single payment` : ""}${exchangeWords}.`,
      data: JSON.stringify({ runId, parts: parts.map(String) }),
    },
  });

  const done = (async () => {
    let moved = 0n;
    for (const [i, part] of parts.entries()) {
      const say = (kind: string, message: string) => db.auditEvent.create({ data: { kind, actor: "agent", message, data: JSON.stringify({ runId, part: i }) } });
      try {
        let amount = rescale(part, USD_DECIMALS, t.decimals);
        if (view.exchanged) {
          // Exchange inside the account first; "only one money action runs per agent wallet at a time".
          const swap = await account.execute({ kind: "swap", asset: t.assetId, amount, destinationAsset: out.assetId }, `home:${runId}:${i}:swap`);
          if (swap.status === "refused") {
            await say("home_failed", `Couldn't move ${formatUsd(part)} back to your wallet: ${swap.refusal.message} Nothing was sent.`);
            break;
          }
          const o = swap.simulated ? { state: "done" as const, amountOut: rescale(part, USD_DECIMALS, out.decimals) } : await settle(account, swap.correlationId);
          if (o.state !== "done") {
            await say(
              "home_failed",
              `The exchange for ${formatUsd(part)} didn't complete${o.state === "pending" ? " yet" : ""}. Nothing was sent; the money is still in your Bursr wallet${o.state === "pending" ? " or on its way back into it" : ""}.`,
            );
            break;
          }
          // Send what the exchange delivered, never more than the account holds of it.
          amount = o.amountOut ?? rescale(part, USD_DECIMALS, out.decimals);
          if (!swap.simulated) {
            const held = (await account.status()).balances[out.assetId] ?? 0n;
            if (held < amount) amount = held;
          }
        }
        const r = await account.execute(
          { kind: "withdraw", asset: out.assetId, amount, chain: home.chain, recipient: home.address, memo: null },
          view.exchanged ? `home:${runId}:${i}:withdraw` : `home:${runId}:${i}`,
        );
        if (r.status === "refused") {
          const left = view.exchanged ? `It's waiting in your Bursr wallet as ${out.symbol} on ${chainName(out.chain)}.` : "Nothing was sent.";
          await say("home_failed", `Couldn't move ${formatUsd(part)} back to your wallet: ${r.refusal.message} ${left}`);
          break;
        }
        // One money action at a time per wallet: wait for this part before the next.
        const o = r.simulated ? { state: "done" as const } : await settle(account, r.correlationId);
        if (o.state === "pending") {
          await say("home_pending", `Moving ${formatUsd(part)} back to your wallet is taking longer than usual. Check the feed on Home before trying again.`);
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
        data: {
          kind: "home_done",
          actor: "agent",
          message: `Moved ${formatUsd(moved)} back to your wallet (${view.label})${view.exchanged ? ", less exchange and network fees" : ""}.`,
          data: JSON.stringify({ runId }),
        },
      });
    }
  })();
  return { amountUsd: want, parts: parts.length, done };
}
