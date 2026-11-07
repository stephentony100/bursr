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
  planned: { label: "Waiting for approval", tone: "text-muted" },
  paying: { label: "Sending…", tone: "text-hold" },
  sent: { label: "Sent, on its way…", tone: "text-hold" },
  delivered: { label: "Delivered", tone: "text-ledger" },
  failed: { label: "Not paid", tone: "text-refuse" },
  refunded: { label: "Refunded to the account", tone: "text-hold" },
};

export default async function PlanPage() {
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness(db());
  if (!business) {
    return (
      <p className="text-muted">
        Set up the business first on the{" "}
        <Link href="/" className="text-indigo underline">
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
          <h1 className="font-display text-3xl font-semibold">This week&apos;s plan</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Bursar puts ready invoices and staff pay into one plan. You approve it once; the agent account then pays each person, and
            refuses anything outside your rules.
          </p>
        </div>
        {(!plan || plan.status !== "draft") && <ActionForm action={preparePlanAction} submit={plan ? "Prepare next plan" : "Prepare this week's plan"} />}
      </div>

      {!plan && <p className="text-muted">No plan yet.</p>}

      {plan && (
        <section className="rounded-xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">
                {plan.status === "draft" ? "Ready for your approval" : `Approved by ${plan.approvedBy} · ${plan.approvedAt?.toLocaleString("en-GB")}`}
              </p>
              <p className="num font-display text-4xl font-semibold">{formatUsd(total)}</p>
              <p className="text-sm text-muted">
                {inPlan.length} payments ·{" "}
                {unquoted === 0
                  ? `costs about ${formatUnits(cost, treasury.decimals)} ${treasury.symbol} with network fees`
                  : `${unquoted} without a price quote (priced again when paid)`}{" "}
                ·{" "}
                {formatUsd(plan.capLeftUsd)} was left under your weekly limit
              </p>
            </div>
            {plan.status === "draft" && (
              <div className="text-right">
                <ActionForm action={approvePlanAction} submit="Approve plan and pay">
                  <input type="hidden" name="planId" value={plan.id} />
                </ActionForm>
                {waitingTaps > 0 && <p className="mt-1 text-sm text-hold">{waitingTaps} payment(s) below need your own tap first.</p>}
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
                        · paid in {i.payout.token.symbol} on {chainName(i.payout.token.chain)}
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
                      ? `fee ${formatUnits(BigInt(i.quote.withdrawFee), i.payout?.token.decimals ?? 6)} · ~${i.quote.timeEstimateSec}s`
                      : "no price quote yet"}
                  </p>
                </div>
                <div className="flex w-56 justify-end gap-2">
                  {plan.status === "draft" ? (
                    <>
                      {i.needsOwnTap && !i.ownTapAt && <ItemButton action={approveItemAction} itemId={i.id} label="Approve this one" tone="primary" />}
                      {i.kind !== "fee" && <ItemButton action={removeItemAction} itemId={i.id} label="Remove" />}
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
          <h2 className="font-display text-xl font-semibold">Not in this plan</h2>
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
          <Link href="/statement" className="text-indigo underline">
            See the statement
          </Link>{" "}
          for every payment and its references.
        </p>
      )}

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Can Bursar go around your limits?</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Send one payment above your largest single payment straight to the agent account, skipping the plan and your approval. The account
          itself should refuse it. {dryRun ? "In practice mode the account is simulated with the same rules." : "In live mode this only asks the account (nothing is sent)."}
        </p>
        <div className="mt-4">
          <ForceTester action={forceOverCapAction} />
        </div>
      </section>
    </div>
  );
}
