import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { changePayoutAction, removePayeeAction, updatePayeeAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { DetailFields, PayoutFields } from "@/components/payee-fields";
import { guardPage, appDb } from "@/lib/session";
import { isOnPayoutHold, payoutHoldEndsAt } from "@/lib/domain";
import { getBusiness, getPayee } from "@/lib/store";

export default async function PayeePage({ params }: PageProps<"/people/[id]">) {
  await guardPage();
  await connection();
  const { id } = await params;
  const [business, payee] = await Promise.all([getBusiness((await appDb())), getPayee((await appDb()), id)]);
  if (!business || !payee) notFound();
  const held = isOnPayoutHold(payee, new Date());

  return (
    <div className="space-y-8">
      <div>
        <Link href="/people" className="inline-flex items-center gap-1.5 text-sm text-indigo underline">
          <ArrowLeft size={14} weight="bold" aria-hidden /> Everyone you pay
        </Link>
        <h1 className="mt-2 display text-2xl sm:text-3xl">{payee.name}</h1>
        {held && (
          <p className="mt-2 rounded-lg bg-hold-soft px-4 py-2 text-sm text-hold">
            Their payment details changed recently. For your safety, payments are on hold until {payoutHoldEndsAt(payee)!.toLocaleString("en-GB")}.
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold">Their details</h2>
        <ActionForm action={updatePayeeAction} submit="Save" className="mt-4">
          <input type="hidden" name="id" value={payee.id} />
          <DetailFields payee={payee} />
        </ActionForm>
      </section>

      <section id="where" className="rounded-2xl border border-hold/40 bg-card p-6">
        <h2 className="text-xl font-bold">Where they get paid</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Only change this after you&apos;ve checked with {payee.name} by phone or in person, never just because an invoice or message
          asked you to. That&apos;s exactly how most payment fraud works. If you&apos;ve paid them before, saving puts them on a 48-hour safety hold; for someone not paid yet the change applies at once.
        </p>
        <ActionForm action={changePayoutAction} submit="Change where they get paid" tone="quiet" className="mt-4">
          <input type="hidden" name="id" value={payee.id} />
          <PayoutFields tokens={business.rules.payoutTokens} payee={payee} />
        </ActionForm>
      </section>

      <section className="rounded-2xl border border-line bg-card p-6">
        <h2 className="text-xl font-bold">Stop paying them</h2>
        <p className="mt-1 text-sm text-muted">Bursr won&apos;t be able to pay them any more. You can add them again later.</p>
        <ActionForm action={removePayeeAction} submit={`Remove ${payee.name}`} tone="danger">
          <input type="hidden" name="id" value={payee.id} />
        </ActionForm>
      </section>
    </div>
  );
}
