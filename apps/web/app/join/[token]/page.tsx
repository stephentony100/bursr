import { connection } from "next/server";
import { submitInviteAction } from "@/app/actions";
import { ActionForm } from "@/components/forms";
import { Logo } from "@/components/logo";
import { db } from "@/lib/db";
import { publicInvite } from "@/lib/invites";
import { chainName } from "@/lib/tokens";

// What an invited staff member or supplier sees. No sign-in: the link is the key,
// it works once, and what they send waits for the business owner's OK.

export const metadata = { title: "How do you want to be paid?", robots: { index: false } };

export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invite = await publicInvite(db(), token);
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-xl items-center px-5">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-xl px-5 py-10">
        {!invite || invite.state === "closed" ? (
          <p className="rounded-2xl border border-line bg-card p-6">This link has expired or was already used. Ask the business for a new one.</p>
        ) : invite.state === "sent" ? (
          <p className="rounded-2xl border border-line bg-card p-6">Thanks, {invite.name}. Your details were sent to {invite.businessName}. You&apos;ll be paid once they confirm them.</p>
        ) : (
          <section className="rounded-2xl border border-line bg-card p-6 sm:p-8">
            <h1 className="display text-3xl">{invite.group ? "How do you want to be paid?" : `Hi ${invite.name}, how do you want to be paid?`}</h1>
            <p className="mt-3 text-muted">
              {invite.businessName} pays with Bursr, in digital dollars (USDC or USDT) sent to your own wallet. Choose the network your wallet uses and paste your address. The
              business checks it with you before anything is paid.
            </p>
            <ActionForm action={submitInviteAction} submit="Send my details" className="mt-6 space-y-5">
              <input type="hidden" name="token" value={token} />
              {invite.group && (
                <label className="block text-sm font-medium">
                  Your full name
                  <input name="name" required autoComplete="name" className="mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2" />
                  <span className="mt-1 block font-normal text-muted">As {invite.businessName} knows you ({invite.name}).</span>
                </label>
              )}
              <label className="block text-sm font-medium">
                I want to be paid in
                <select name="token_asset" required className="mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2">
                  {invite.tokens.map((t) => (
                    <option key={t.assetId} value={t.assetId}>
                      {t.symbol} on {chainName(t.chain)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                My wallet address on that network
                <input name="address" required spellCheck={false} autoComplete="off" className="num mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" />
                <span className="mt-1 block font-normal text-muted">Copy it from your wallet app (&quot;Receive&quot;). Double-check the network matches.</span>
              </label>
              <label className="block text-sm font-medium">
                Memo <span className="font-normal text-muted">(only if your wallet or exchange gave you one)</span>
                <input name="memo" autoComplete="off" className="num mt-1 block w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" />
              </label>
            </ActionForm>
          </section>
        )}
      </main>
    </div>
  );
}
