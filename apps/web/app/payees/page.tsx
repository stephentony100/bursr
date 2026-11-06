import Link from "next/link";
import { connection } from "next/server";
import { addPayeeAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { DetailFields, PayoutFields } from "@/components/payee-fields";
import { db } from "@/lib/db";
import { isNewPayee, isOnPayoutHold, payoutHoldEndsAt } from "@/lib/domain";
import { formatUsd } from "@/lib/money";
import { getBusiness, listPayees } from "@/lib/store";
import { chainName } from "@/lib/tokens";

export default async function PayeesPage() {
  await connection();
  const [business, payees] = await Promise.all([getBusiness(db()), listPayees(db())]);
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
  const now = new Date();
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-semibold">Payees</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Bursar can only pay the people on this list, at exactly these addresses. Only you can add someone or change where they are
          paid. A change puts that payee on hold for 48 hours, the usual window for a fake &ldquo;our bank details changed&rdquo; message
          to come to light.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {payees.length === 0 && <li className="px-5 py-4 text-sm text-muted">No payees yet. Add the first one below.</li>}
        {payees.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4">
            <div className="min-w-56 flex-1">
              <Link href={`/payees/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <p className="text-sm capitalize text-muted">
                {p.category}
                {p.recurring && (
                  <span className="normal-case">
                    {" "}
                    · {formatUsd(BigInt(p.recurring.amountUsd))} every {p.recurring.every}
                  </span>
                )}
              </p>
            </div>
            <div className="text-sm">
              {p.payout.token.symbol} on {chainName(p.payout.token.chain)}
              <p className="num max-w-64 truncate text-xs text-muted" title={p.payout.address}>
                {p.payout.address}
              </p>
            </div>
            <div className="w-44 text-right text-sm">
              {isOnPayoutHold(p, now) ? (
                <span className="rounded-full bg-hold-soft px-2 py-0.5 text-hold">
                  On hold until {payoutHoldEndsAt(p)!.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              ) : isNewPayee(p, now) ? (
                <span className="rounded-full bg-paper px-2 py-0.5 text-muted">New: asks you first</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Add a payee</h2>
        <ActionForm action={addPayeeAction} submit="Add payee" className="mt-4 space-y-5">
          <DetailFields />
          <PayoutFields tokens={business.rules.payoutTokens} />
        </ActionForm>
      </section>
    </div>
  );
}
