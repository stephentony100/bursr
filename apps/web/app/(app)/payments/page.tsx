import Link from "next/link";
import { connection } from "next/server";
import { approveItemAction, approvePlanAction, forceOverCapAction, preparePlanAction, removeItemAction } from "@/app/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, ForceTester, ItemButton } from "@/components/forms";
import { Badge, type Tone } from "@/components/ui/badge";
import { guardPage, appDb } from "@/lib/session";
import { readEnv } from "@/lib/env";
import { shortenAddresses } from "@/lib/address";
import { listInvoices } from "@/lib/invoices";
import { formatUsd, rescale } from "@/lib/money";
import { refreshPayments } from "@/lib/pay";
import { getLatestPlan, type PlanItemView } from "@/lib/plans";
import { getBusiness } from "@/lib/store";
import { chainName } from "@/lib/tokens";

const PAY_STATUS: Record<PlanItemView["payStatus"], { label: string; tone: Tone }> = {
  planned: { label: "Waiting for your OK", tone: "neutral" },
  paying: { label: "Paying…", tone: "hold" },
  waiting: { label: "Agent will retry", tone: "hold" },
  sent: { label: "Sent, on its way…", tone: "hold" },
  delivered: { label: "Paid", tone: "ready" },
  failed: { label: "Not paid", tone: "block" },
  refunded: { label: "Money returned to your wallet", tone: "hold" },
};

/** A transfer fee in the payout token's units, to the cent; tiny fees say so instead of rounding to $0.00. */
function FeeText({ raw, decimals }: { raw: bigint; decimals: number }) {
  const micros = rescale(raw, decimals, 6);
  return micros < 10_000n ? (
    <>
      under <span className="num">$0.01</span>
    </>
  ) : (
    <span className="num">{formatUsd(micros)}</span>
  );
}

export default async function PlanPage() {
  await guardPage();
  await connection();
  const dryRun = readEnv().BURSAR_MODE === "dry-run";
  const business = await getBusiness((await appDb()));
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
  await refreshPayments((await appDb()));
  const plan = await getLatestPlan((await appDb()));
  const invoiceStatus = new Map((await listInvoices((await appDb()))).map((v) => [v.id, v.status]));
  const treasury = business.rules.treasury;

  const inPlan = plan?.items.filter((i) => i.placement === "in") ?? [];
  const out = plan?.items.filter((i) => i.placement !== "in") ?? [];
  const total = inPlan.reduce((a, i) => a + i.amountUsd, 0n);
  const cost = inPlan.reduce((a, i) => a + (i.quote ? BigInt(i.quote.minAmountIn) : 0n), 0n);
  const unquoted = inPlan.filter((i) => !i.quote).length;
  const waitingTaps = inPlan.filter((i) => i.needsOwnTap && !i.ownTapAt).length;
  const moving = inPlan.some((i) => i.payStatus === "paying" || i.payStatus === "sent");
  // The approve form disappears once the list is approved, so the page itself says what happened.
  const going = inPlan.filter((i) => i.payStatus !== "failed").length;

  return (
    <div className="space-y-10">
      <AutoRefresh active={moving} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-2xl sm:text-3xl">Payments</h1>
          <p className="mt-1 text-muted">This week&apos;s pay and checked invoices, in one list.</p>
        </div>
        {(!plan || plan.status !== "draft") && <ActionForm action={preparePlanAction} submit={!plan ? "Get this week's payments ready" : !moving && inPlan.some((i) => i.payStatus === "failed" || i.payStatus === "refunded") ? "Try the unpaid payments again" : "Get next week's payments ready"} />}
      </div>

      {!plan && <p className="text-muted">No plan yet.</p>}

      {plan && (
        <section className="rounded-2xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">
                {plan.status === "draft" ? "Ready for your OK" : `${plan.approvedBy === "agent" ? "Your agent paid these on its own on" : "You approved this on"} ${plan.approvedAt?.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
              </p>
              <p className="num whitespace-nowrap text-4xl font-semibold">{formatUsd(total)}</p>
              {plan.status !== "draft" && moving && (
                <p role="status" className="font-semibold text-ok">
                  Done. {going} payment{going === 1 ? "" : "s"} on the way.
                </p>
              )}
              <p className="text-sm text-muted">
                {inPlan.length} payments ·{" "}
                {unquoted === 0
                  ? `about ${formatUsd(rescale(cost, treasury.decimals, 6))} including transfer fees`
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

          <div className="-mx-6 mt-6 overflow-x-auto border-t border-line" tabIndex={0} role="region" aria-label="This week's payments">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="whitespace-nowrap [overflow-wrap:normal] bg-paper text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-6 py-2.5 font-medium">Pay</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Paid in</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th scope="col" className="px-6 py-2.5 text-right font-medium">{plan.status === "draft" ? "Actions" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inPlan.map((i) => (
                  <tr key={i.id} className="align-top hover:bg-paper/60">
                    <td className="px-6 py-3">
                      <p className="font-medium">{i.payeeName}</p>
                      <p className="text-muted">{i.forWhat}</p>
                      {i.ownTapReason && !i.ownTapAt && <p className="text-hold">{i.ownTapReason}</p>}
                      {i.payReason && <p className="text-refuse">{i.payReason}</p>}
                      {!i.quote && i.quoteError && plan.status === "draft" && <p className="text-xs text-muted">{i.quoteError}</p>}
                    </td>
                    <td className="px-3 py-3 text-muted">{i.payout ? `gets ${i.payout.token.symbol} on ${chainName(i.payout.token.chain)}` : "Not set"}</td>
                    <td className="px-3 py-3 text-right">
                      <p className="num font-medium">{formatUsd(i.amountUsd)}</p>
                      <p className="text-xs tabular-nums text-muted">
                        {i.networkFee !== null ? (
                          <>
                            + <FeeText raw={i.networkFee} decimals={i.payout?.token.decimals ?? 6} /> network fee, paid by you
                          </>
                        ) : i.quote ? (
                          <>
                            + about <FeeText raw={BigInt(i.quote.withdrawFee)} decimals={i.payout?.token.decimals ?? 6} /> network fee, paid by you · arrives in about {i.quote.timeEstimateSec}s
                          </>
                        ) : (
                          "network fee worked out when paid"
                        )}
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        {plan.status === "draft" ? (
                          <>
                            {i.needsOwnTap && !i.ownTapAt && <ItemButton action={approveItemAction} itemId={i.id} label="OK this one" tone="primary" />}
                            {i.kind !== "fee" && <ItemButton action={removeItemAction} itemId={i.id} label="Not this week" />}
                          </>
                        ) : (
                          <Badge tone={PAY_STATUS[i.payStatus].tone}>{PAY_STATUS[i.payStatus].label}</Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {out.length > 0 && (
        <section>
          <h2 className="text-xl font-bold">Not paid this week, and why</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-card" tabIndex={0} role="region" aria-label="Not paid this week">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="whitespace-nowrap [overflow-wrap:normal] bg-paper text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Invoice</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Why it&apos;s not paid</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {out.map((i) => {
                  const blocked = i.placement === "held" && i.invoiceId && invoiceStatus.get(i.invoiceId) === "block";
                  return (
                    <tr key={i.id} className="align-top">
                      <td className="px-5 py-3">
                        <p className="font-medium">{i.payeeName}</p>
                        <p className="text-muted">{i.forWhat}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={i.placement !== "held" ? "neutral" : blocked ? "block" : "hold"}>{i.placement !== "held" ? "Not this week" : blocked ? "Blocked" : "On hold"}</Badge>
                        <p className={`mt-1 ${i.placement !== "held" ? "text-muted" : blocked ? "text-refuse" : "text-hold"}`}>{i.reason && shortenAddresses(i.reason)}</p>
                      </td>
                      <td className="num px-5 py-3 text-right">{i.amountUsd > 0n ? formatUsd(i.amountUsd) : "Not read"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold">Can anyone get around your limits?</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Try it yourself: Bursr sends one payment bigger than your limit straight to your wallet, skipping this list and your approval.
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
