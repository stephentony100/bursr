import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/logo";
import { ConnectWallet } from "@/components/onboarding";
import { readEnv } from "@/lib/env";
import { getOwner } from "@/lib/session";

// Live mode: the one door for everyone. Connect a wallet; an owner goes
// straight to their business, a new wallet goes to setup (/this-week decides).
export const metadata = { title: "Sign in to Bursar" };

export default async function SignIn() {
  await connection();
  if (readEnv().BURSAR_MODE === "dry-run") redirect("/this-week");
  if (await getOwner()) redirect("/this-week");
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper px-5">
      <main id="main" className="w-full max-w-md rounded-xl border border-line bg-card p-8">
        <Logo />
        <h1 className="display mt-6 text-3xl">Continue with your wallet</h1>
        <p className="mt-2 text-muted">
          Already use Bursar? You&apos;ll go straight to your business. New here? We&apos;ll set your business up together, step by step.
        </p>
        <div className="mt-6">
          <ConnectWallet />
        </div>
        <p className="mt-6 text-sm text-muted">
          Only you can see your business, your people and your payments. Connecting is free and moves no money. No wallet yet? Install a NEAR wallet app such as HOT
          Wallet, create an account, then come back here.
        </p>
      </main>
    </div>
  );
}
