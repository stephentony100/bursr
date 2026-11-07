import Link from "next/link";
import { connection } from "next/server";
import { approveItemAction, approvePlanAction, forceOverCapAction, preparePlanAction, removeItemAction } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, ForceTester, ItemButton } from "@/components/forms";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { formatUnits, formatUsd } from "@/lib/money";
import { refreshPayments } from "@/lib/pay";
import { getLatestPlan, type PlanItemView } from "@/lib/plans";
import { getBusiness } from "@/lib/store";
import { chainName } from "@/lib/tokens";

const PAY_STATUS: Record<PlanItemView["payStatus"], { label: string; tone: string }> = {
  planned: { label: "Waiting for your OK", tone: "text-muted" },
  paying: { label: "Paying…", tone: "text-hold" },
  sent: { label: "Sent, on its way…", tone: "text-hold" },
  delivered: { label: "Paid ✓", tone: "text-ledger" },
  failed: { label: "Not paid", tone: "text-refuse" },
  refunded: { label: "Money returned to your wallet", tone: "text-hold" },
};

export default async function PlanPage() {
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());
  if (!business) {
    return (
      <p className="text-muted">
        Set up the business first on the{" "}
        <Link href="/this-week" className="text-indigo underline">
          This week
        </Link>{" "}
        page.
      </p>
    );
  }
  await refreshPayments(db());
  const plan = await getLatestPlan(db());
  const treasury = business.rules.treasury;

  const inPlan = plan?.items.filter((i) => i.placement === "in") ?? [];
  const out = plan?.items.filter((i) => i.placement !== "in") ?? [];
  const total = inPlan.reduce((a, i) => a + i.amountUsd, 0n);
  const cost = inPlan.reduce((a, i) => a + (i.quote ? BigInt(i.quote.minAmountIn) : 0n), 0n);
  const unquoted = inPlan.filter((i) => !i.quote).length;
  const waitingTaps = inPlan.filter((i) => i.needsOwnTap && !i.ownTapAt).length;
  const moving = inPlan.some((i) => i.payStatus === "paying" || i.payStatus === "sent");

  return (
    <div className="space-y-10">
      <AutoRefresh active={moving} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">This week&apos;s payments</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every invoice that passed its checks, plus your staff&apos;s pay, in one list. Look it over, tap approve once, and everyone gets
            paid in the digital dollars they prefer. Anything outside your spending rules simply can&apos;t go out.
          </p>
        </div>
        {(!plan || plan.status !== "draft") && <ActionForm action={preparePlanAction} submit={plan ? "Get next week's payments ready" : "Get this week's payments ready"} />}
      </div>

      {!plan && <p className="text-muted">No plan yet.</p>}

      {plan && (
        <section className="rounded-xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">
                {plan.status === "draft" ? "Ready for your OK" : `You approved this on ${plan.approvedAt?.toLocaleString("en-GB")}`}
              </p>
              <p className="num font-display text-4xl font-semibold">{formatUsd(total)}</p>
              <p className="text-sm text-muted">
                {inPlan.length} payments ·{" "}
                {unquoted === 0
                  ? `about $${formatUnits(cost, treasury.decimals)} including transfer fees`
                  : `fees for ${unquoted} will be worked out when paid`}{" "}
                ·{" "}
                {formatUsd(plan.capLeftUsd)} was left of your weekly limit
              </p>
            </div>
            {plan.status === "draft" && (
              <div className="text-right">
                <ActionForm action={approvePlanAction} submit="Approve and pay everyone">
                  <input type="hidden" name="planId" value={plan.id} />
                </ActionForm>
                {waitingTaps > 0 && <p className="mt-1 text-sm text-hold">{waitingTaps} payment(s) below need your own OK first.</p>}
              </div>
            )}
          </div>

          <ul className="mt-6 divide-y divide-line border-t border-line">
            {inPlan.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
                <div className="min-w-56 flex-1">
                  <p className="font-medium">{i.payeeName}</p>
                  <p className="text-sm text-muted">
                    {i.forWhat}
                    {i.payout && (
                      <>
                        {" "}
                        · gets {i.payout.token.symbol} on {chainName(i.payout.token.chain)}
                      </>
                    )}
                  </p>
                  {i.ownTapReason && !i.ownTapAt && <p className="text-sm text-hold">{i.ownTapReason}</p>}
                  {i.payReason && <p className="text-sm text-refuse">{i.payReason}</p>}
                  {!i.quote && i.quoteError && plan.status === "draft" && <p className="text-xs text-muted">{i.quoteError}</p>}
                </div>
                <div className="text-right">
                  <p className="num font-medium">{formatUsd(i.amountUsd)}</p>
                  <p className="num text-xs text-muted">
                    {i.quote
                      ? `fee $${formatUnits(BigInt(i.quote.withdrawFee), i.payout?.token.decimals ?? 6)} · arrives in ~${i.quote.timeEstimateSec}s`
                      : "fee worked out when paid"}
                  </p>
                </div>
                <div className="flex w-56 justify-end gap-2">
                  {plan.status === "draft" ? (
                    <>
                      {i.needsOwnTap && !i.ownTapAt && <ItemButton action={approveItemAction} itemId={i.id} label="OK this one" tone="primary" />}
                      {i.kind !== "fee" && <ItemButton action={removeItemAction} itemId={i.id} label="Not this week" />}
                    </>
                  ) : (
                    <span className={`text-sm font-medium ${PAY_STATUS[i.payStatus].tone}`}>{PAY_STATUS[i.payStatus].label}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {out.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold">Not paid this week, and why</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-card">
            {out.map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm">
                <div className="min-w-56 flex-1">
                  <p className="font-medium">
                    {i.payeeName} <span className="font-normal text-muted">· {i.forWhat}</span>
                  </p>
                  <p className={i.placement === "removed" ? "text-muted" : i.placement === "deferred" ? "text-muted" : "text-hold"}>{i.reason}</p>
                </div>
                <p className="num">{i.amountUsd > 0n ? formatUsd(i.amountUsd) : "—"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan && plan.status !== "draft" && (
        <p className="text-sm">
          <Link href="/records" className="text-indigo underline">
            See your records
          </Link>{" "}
          for every payment, with proof.
        </p>
      )}

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Can anyone get around your limits?</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Try it yourself: Bursar sends one payment bigger than your limit straight to your wallet, skipping this list and your approval.
          Your spending rules live in the wallet itself, so it should be stopped there.{" "}
          {dryRun ? "In the demo, the wallet follows the same rules with practice money." : "In live mode this only asks the wallet; nothing is sent."}
        </p>
        <div className="mt-4">
          <ForceTester action={forceOverCapAction} />
        </div>
      </section>
    </div>
  );
}
