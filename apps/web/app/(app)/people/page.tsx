import Link from "next/link";
import { connection } from "next/server";
import { addPayeeAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { InvitesList } from "@/components/invites-list";
import { InviteForm } from "@/components/onboarding";
import { PayOnce } from "@/components/pay-once";
import { DetailFields, PayoutFields } from "@/components/payee-fields";
import { guardPage, appDb } from "@/lib/session";
import { isOnPayoutHold, payoutHoldEndsAt } from "@/lib/domain";
import { listInvites } from "@/lib/invites";
import { formatUsd } from "@/lib/money";
import { scheduleWords } from "@/lib/schedule";
import { getBusiness, listPayees } from "@/lib/store";
import { chainName } from "@/lib/tokens";
import { readEnv } from "@/lib/env";
import { pendingChanges } from "@/lib/pending-changes";

export default async function PayeesPage({ searchParams }: { searchParams: Promise<{ removed?: string }> }) {
  await guardPage();
  await connection();
  const [business, payees, invites] = await Promise.all([getBusiness((await appDb())), listPayees((await appDb())), listInvites((await appDb()))]);
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
  const now = new Date();
  const removed = (await searchParams).removed;
  const live = readEnv().BURSAR_MODE === "live";
  // Removing someone whose address another person still uses changes nothing in the wallet.
  const removedPending = live && removed !== undefined && Boolean(await pendingChanges(await appDb()));
  return (
    <div className="space-y-10">
      {removed !== undefined && (
        <p role="status" className="rounded-xl border border-ledger/40 bg-ledger-soft px-5 py-4 text-sm">
          <span className="font-semibold">{removed ? `${removed} was removed.` : "Removed."}</span> Bursar can no longer pay them.
          {removedPending && (
            <>
              {" "}
              Your agent won&apos;t pay them from now on. To lock it into your agent&apos;s wallet too, use <strong>Confirm with my wallet</strong> at the top of the page.
            </>
          )}
        </p>
      )}
      <div>
        <h1 className="display text-4xl">People you pay</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Bursar can only ever pay the people on this list, at exactly these addresses. Only you can add someone or change where they
          get paid. If you change it for someone you&apos;ve paid before, their payments wait 48 hours first. That&apos;s usually long enough for a fake &ldquo;our bank details
          have changed&rdquo; message to come to light.
        </p>
      </div>

      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {payees.length === 0 && <li className="px-5 py-4 text-sm text-muted">Nobody here yet. Add your first supplier or staff member below.</li>}
        {payees.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-4">
            <div className="min-w-56 flex-1">
              <Link href={`/people/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
              <p className="text-sm text-muted">
                {{ supplier: "Supplier", staff: "Staff", software: "Subscription or service" }[p.category]}
                {p.recurring && (
                  <span className="normal-case">
                    {" "}
                    · {formatUsd(BigInt(p.recurring.amountUsd))} {scheduleWords(p.recurring, business.rules.paydayWeekday)}
                  </span>
                )}
                {!p.recurring && " · Paid when they send an invoice"}
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
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-hold-soft px-2 py-0.5 text-xs font-medium text-hold">
                  Safety hold until {payoutHoldEndsAt(p)!.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              ) : !p.trustedAt ? (
                <span className="inline-flex w-fit items-center rounded-full bg-paper-2 px-2 py-0.5 text-xs font-medium text-muted">{live ? "Waiting for your wallet to confirm" : "First payment needs your OK"}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <section id="pay-once" className="space-y-4 rounded-xl border border-line bg-card p-6">
        <div>
          <h2 className="text-xl font-bold">Pay someone once</h2>
          <p className="mt-1 text-sm text-muted">A quick job, a delivery, a repair. Your agent pays them as soon as they&apos;re approved, inside your limits.</p>
        </div>
        <PayOnce tokens={business.rules.payoutTokens} live={live} />
      </section>

      <section className="space-y-4 rounded-xl border border-line bg-card p-6">
        <div>
          <h2 className="text-xl font-bold">Invite someone</h2>
          <p className="mt-1 text-sm text-muted">Don&apos;t know their wallet address? Send them a link; they choose how they want to be paid, and you approve it before they can be paid.</p>
        </div>
        <InvitesList invites={invites} />
        <InviteForm />
      </section>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold">Add someone you pay</h2>
        <ActionForm action={addPayeeAction} submit="Add them" className="mt-4 space-y-5">
          <DetailFields />
          <PayoutFields tokens={business.rules.payoutTokens} />
        </ActionForm>
      </section>
    </div>
  );
}
