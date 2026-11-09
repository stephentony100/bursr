import { approveInviteAction, declineInviteAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import type { InviteView } from "@/lib/invites";
import { chainName } from "@/lib/tokens";

/** Invites sent and not settled yet: waiting for the person, or waiting for the owner's OK. */
export function InvitesList({ invites }: { invites: InviteView[] }) {
  if (invites.length === 0) return null;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-card">
      {invites.map((i) => (
        <li key={i.id} className="space-y-2 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{i.name}</span>
            <span className="text-muted">{i.status === "open" ? "Invite sent, waiting for their details" : "Sent their details: check and approve"}</span>
          </div>
          {i.status === "submitted" && i.payout && (
            <div className="rounded-lg bg-paper p-3">
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
  );
}
