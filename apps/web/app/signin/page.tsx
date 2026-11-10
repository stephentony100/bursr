import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { HeaderWallet } from "@/components/header-wallet";
import { Logo } from "@/components/logo";
import { ConnectWallet } from "@/components/onboarding";
import { db } from "@/lib/db";
import { readEnv } from "@/lib/env";
import { getOwner } from "@/lib/session";
import { getBusiness } from "@/lib/store";

// Live mode: the only page a signed-out visitor sees of a business's Bursar.
export const metadata = { title: "Sign in to Bursar" };

export default async function SignIn() {
  await connection();
  if (readEnv().BURSAR_MODE === "dry-run") redirect("/this-week");
  const [business, owner] = await Promise.all([getBusiness(db()), getOwner()]);
  if (!business) redirect("/welcome");
  if (owner && owner.accountId === business.ownerAccountId) redirect("/this-week");
  const wrongWallet = Boolean(owner);
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-5">
      <main id="main" className="w-full max-w-md rounded-xl border border-line bg-card p-8">
        <Logo />
        <h1 className="display mt-6 text-3xl">{wrongWallet ? "This isn't your business" : "Sign in to Bursar"}</h1>
        <p className="mt-2 text-muted">
          {wrongWallet
            ? "You're signed in with a different wallet from the one that owns this Bursar. Sign out and connect the owner's wallet."
            : "Connect the wallet you set Bursar up with. Only you can see your business, your people and your payments."}
        </p>
        <div className="mt-6">{wrongWallet ? <HeaderWallet accountId={owner!.accountId} tone="dark" /> : <ConnectWallet />}</div>
        {!wrongWallet && (
          <p className="mt-6 text-sm text-muted">
            New here?{" "}
            <Link href="/welcome" className="text-indigo underline">
              Set up your business
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
