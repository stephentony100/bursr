import Link from "next/link";
import { connection } from "next/server";
import { addPayeeAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { InvitesList } from "@/components/invites-list";
import { InviteForm } from "@/components/onboarding";
import { PeopleImport } from "@/components/people-import";
import { importTemplate } from "@/lib/people-import";
import { MAX_ADDRESSES } from "@/lib/owner-actions";
import { PayOnce } from "@/components/pay-once";
import { Tabs } from "@/components/tabs";
import { Avatar } from "@/components/agent-panel";
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
        <p role="status" className="rounded-2xl border border-ledger/40 bg-ledger-soft px-5 py-4 text-sm">
          <span className="font-semibold">{removed ? `${removed} was removed.` : "Removed."}</span> Bursr can no longer pay them.
          {removedPending && (
            <>
              {" "}
              Your agent won&apos;t pay them from now on. To lock it into your agent&apos;s wallet too, use <strong>Confirm with my wallet</strong> at the top of the page.
            </>
          )}
        </p>
      )}
      <div>
        <h1 className="display text-2xl sm:text-3xl">People</h1>
        <p className="mt-1 text-muted">Your agent can only pay these people, at these addresses.</p>
      </div>

      <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
        {payees.length === 0 && <li className="px-5 py-4 text-sm text-muted">Nobody yet. Add someone below.</li>}
        {payees.map((p) => (
          <li key={p.id}>
            <Link href={`/people/${p.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted">
                  {{ supplier: "Supplier", staff: "Staff", software: "Subscription" }[p.category]}
                  {p.recurring ? ` · ${formatUsd(BigInt(p.recurring.amountUsd))} ${scheduleWords(p.recurring, business.rules.paydayWeekday)}` : " · Paid by invoice"}
                </p>
              </div>
              <div className="hidden min-w-0 text-right sm:block">
                <p className="text-sm font-medium">
                  {p.payout.token.symbol} · {chainName(p.payout.token.chain)}
                </p>
                <p className="addr max-w-56 truncate text-muted" title={p.payout.address}>
                  {p.payout.address}
                </p>
              </div>
              {isOnPayoutHold(p, now) ? (
                <span className="shrink-0 rounded-full bg-hold-soft px-2.5 py-1 text-xs font-semibold text-hold">
                  On hold to {payoutHoldEndsAt(p)!.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              ) : !p.trustedAt ? (
                <span className="shrink-0 rounded-full bg-paper-2 px-2.5 py-1 text-xs font-semibold text-muted">{live ? "Confirm with wallet" : "First pay needs OK"}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <InvitesList invites={invites} />

      <section aria-labelledby="add-people" className="space-y-3">
        <h2 id="add-people" className="text-lg font-bold">
          Add people
        </h2>
        <Tabs
          label="Ways to add people"
          tabs={[
            {
              id: "add",
              label: "Add someone",
              panel: (
                <ActionForm action={addPayeeAction} submit="Add them" className="space-y-5">
                  <DetailFields />
                  <PayoutFields tokens={business.rules.payoutTokens} />
                </ActionForm>
              ),
            },
            {
              id: "invite",
              label: "Send a link",
              panel: (
                <div className="space-y-4">
                  <p className="text-sm text-muted">They fill in their wallet. You approve it.</p>
                  <InviteForm />
                </div>
              ),
            },
            {
              id: "pay-once",
              label: "Pay once",
              panel: (
                <div className="space-y-4">
                  <p className="text-sm text-muted">A quick job, a delivery, a repair.</p>
                  <PayOnce tokens={business.rules.payoutTokens} live={live} />
                </div>
              ),
            },
            {
              id: "many",
              label: "Add many",
              panel: (
                <div className="space-y-4">
                  <p className="text-sm text-muted">From a spreadsheet. Up to {MAX_ADDRESSES} addresses.</p>
                  <PeopleImport template={importTemplate(business.rules.payoutTokens)} live={live} />
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
