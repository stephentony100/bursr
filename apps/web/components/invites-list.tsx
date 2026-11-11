import { approveAllInvitesAction, approveInviteAction, declineInviteAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { readEnv } from "@/lib/env";
import type { InviteView } from "@/lib/invites";
import { chainName } from "@/lib/tokens";

/** Invites sent and not settled yet: waiting for the person, or waiting for the owner's OK. */
export function InvitesList({ invites }: { invites: InviteView[] }) {
  if (invites.length === 0) return null;
  const base = readEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const submitted = invites.filter((i) => i.status === "submitted").length;
  return (
    <div className="space-y-3">
      {submitted > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ledger/40 bg-ledger-soft/60 px-4 py-3 text-sm">
          <span>
            <span className="font-semibold">{submitted} people sent their details.</span> Check the addresses with them, then add everyone at once.
          </span>
          <ActionForm action={approveAllInvitesAction} submit={`Approve all ${submitted}`} />
        </div>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        {invites.map((i) => (
          <li key={i.id} className="space-y-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {i.name}
                {i.group && <span className="font-normal text-muted"> · group link</span>}
              </span>
              <span className="text-muted">
                {i.group
                  ? `Open until ${i.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}; answers appear here`
                  : i.status === "open"
                    ? "Invite sent, waiting for their details"
                    : "Sent their details: check and approve"}
              </span>
            </div>
            {i.group && (
              <p className="num break-all rounded bg-paper px-2 py-1.5 text-xs">
                {base}/join/{i.token}
              </p>
            )}
            {i.status === "submitted" && i.payout && (
              <div className="rounded-xl bg-paper p-3">
                <p>
                  Wants {i.payout.token.symbol} on {chainName(i.payout.token.chain)} at <span className="num break-all">{i.payout.address}</span>
                  {i.payout.memo && ` (memo ${i.payout.memo})`}
                </p>
                <p className="mt-1 text-muted">Check the address with {i.name} on a call or in person before you approve.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionForm action={approveInviteAction} submit="Approve">
                    <input type="hidden" name="inviteId" value={i.id} />
                  </ActionForm>
                  <ActionForm action={declineInviteAction} submit="Decline" tone="quiet">
                    <input type="hidden" name="inviteId" value={i.id} />
                  </ActionForm>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
