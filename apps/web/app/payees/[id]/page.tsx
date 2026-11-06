import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { changePayoutAction, removePayeeAction, updatePayeeAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { DetailFields, PayoutFields } from "@/components/payee-fields";
import { db } from "@/lib/db";
import { isOnPayoutHold, payoutHoldEndsAt } from "@/lib/domain";
import { getBusiness, getPayee } from "@/lib/store";

export default async function PayeePage({ params }: PageProps<"/payees/[id]">) {
  await connection();
  const { id } = await params;
  const [business, payee] = await Promise.all([getBusiness(db()), getPayee(db(), id)]);
  if (!business || !payee) notFound();
  const held = isOnPayoutHold(payee, new Date());

  return (
    <div className="space-y-8">
      <div>
        <Link href="/payees" className="text-sm text-indigo underline">
          All payees
        </Link>
        <h1 className="mt-2 font-display text-3xl font-semibold">{payee.name}</h1>
        {held && (
          <p className="mt-2 rounded-md bg-hold-soft px-4 py-2 text-sm text-hold">
            Payout details changed recently. Payments are on hold until {payoutHoldEndsAt(payee)!.toLocaleString("en-GB")}.
          </p>
        )}
      </div>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Details</h2>
        <ActionForm action={updatePayeeAction} submit="Save details" className="mt-4">
          <input type="hidden" name="id" value={payee.id} />
          <DetailFields payee={payee} />
        </ActionForm>
      </section>

      <section className="rounded-xl border border-hold/40 bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Where they are paid</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Only change this after confirming with {payee.name} by phone or in person, never because an invoice or message asked you to.
          Saving puts them on hold for 48 hours.
        </p>
        <ActionForm action={changePayoutAction} submit="Change payout details" tone="quiet" className="mt-4">
          <input type="hidden" name="id" value={payee.id} />
          <PayoutFields tokens={business.rules.payoutTokens} payee={payee} />
        </ActionForm>
      </section>

      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Remove</h2>
        <p className="mt-1 text-sm text-muted">Bursar will no longer be able to pay them.</p>
        <ActionForm action={removePayeeAction} submit={`Remove ${payee.name}`} tone="danger">
          <input type="hidden" name="id" value={payee.id} />
        </ActionForm>
      </section>
    </div>
  );
}
