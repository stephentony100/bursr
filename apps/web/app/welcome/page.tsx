import { Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { addPayeeAction, onboardBusinessAction, onboardNextAction, practiceMoneyAction, startOwnPracticeAction } from "@/app/actions";
import { AddMoney } from "@/components/add-money";
import { Logo } from "@/components/logo";
import { ActionForm } from "@/components/forms";
import { InvitesList } from "@/components/invites-list";
import { ConnectWallet, InviteForm, LimitsForm, TimeZoneField } from "@/components/onboarding";
import { DetailFields, PayoutFields } from "@/components/payee-fields";
import { WalletPanel } from "@/components/wallet-panel";
import { comingUp } from "@/lib/agent/view";
import { grantState } from "@/lib/grant-store";
import { listInvites } from "@/lib/invites";
import { formatUsd } from "@/lib/money";
import { onboardingState, STEP_TITLES, STEPS, type Step } from "@/lib/onboarding";
import { policyNeedsSigning } from "@/lib/owner-actions";
import { SAMPLE_NAME } from "@/lib/sample";
import { scheduleWords } from "@/lib/schedule";
import { getOwner, appDb } from "@/lib/session";
import { getAccountRecord, getBusiness, listPayees } from "@/lib/store";
import { chainName, payoutTokens } from "@/lib/tokens";

export const metadata = { title: "Set up Bursr" };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Welcome({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  await connection();
  const owner = await getOwner();
  const state = await onboardingState((await appDb()), owner);
  const asked = (await searchParams).step as Step | undefined;
  // An owner may go back to a step they have done; never ahead of the first open one.
  // Signed out (live): only the wallet step, whatever the link asks for; nothing about an existing business is shown.
  const step: Step =
    state.live && !owner ? "wallet" : asked && STEPS.includes(asked) && (state.done[asked] || asked === state.current) ? asked : state.current;
  const business = await getBusiness((await appDb()));
  // Setup finished: a signed-in owner arriving here goes to their dashboard (going back to a step is still possible).
  if (owner && business && state.finished && !asked) redirect("/this-week");
  // Signed out (live): show a blank set of steps; whether this Bursr is set up, and how far, is the owner's business.
  const signedOut = state.live && !owner;
  const shownDone = signedOut ? (Object.fromEntries(STEPS.map((s) => [s, false])) as Record<Step, boolean>) : state.done;
  // Practice restaurant loaded: offer to start a business of your own instead.
  const onSample = !state.live && business?.name === SAMPLE_NAME;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" aria-label="Bursr home">
            <Logo />
          </Link>
          {!state.live && <span className="text-sm text-hold">Practice mode · practice money</span>}
        </div>
      </header>
      <main id="main" className="mx-auto grid max-w-5xl gap-8 px-5 py-10 md:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Setup steps">
          <ol className="space-y-1">
            {STEPS.filter((s) => state.live || s !== "wallet").map((s, i) => {
              const reachable = !signedOut && (shownDone[s] || s === state.current);
              const here = s === step;
              const body = (
                <>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${shownDone[s] ? "bg-ledger text-white" : here ? "bg-ink text-white" : "bg-paper-2 text-muted"}`}>
                    {shownDone[s] ? <Check size={13} weight="bold" aria-hidden /> : i + 1}
                  </span>
                  {STEP_TITLES[s]}
                </>
              );
              return (
                <li key={s}>
                  {reachable && !here ? (
                    <Link href={`/welcome?step=${s}`} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-card">
                      {body}
                    </Link>
                  ) : (
                    <span aria-current={here ? "step" : undefined} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${here ? "bg-card font-semibold" : "text-muted"}`}>
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="rounded-xl border border-line bg-card p-6 sm:p-8">
          {onSample ? (
            <div className="space-y-4">
              <h1 className="display text-3xl">Set up your own business</h1>
              <p className="text-muted">
                You&apos;re looking at the sample restaurant. To try setting up a business of your own with practice money, start fresh: the sample is cleared (you can load it again
                any time from This week).
              </p>
              <ActionForm action={startOwnPracticeAction} submit="Start my own business" />
              <Link href="/this-week" className="block text-sm text-indigo underline">
                Back to the sample restaurant
              </Link>
            </div>
          ) : (
            <>
              <h1 className="display text-3xl">{STEP_TITLES[step]}</h1>
              <div className="mt-6">{await StepBody({ step, live: state.live, businessName: signedOut ? null : (business?.name ?? null) })}</div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

async function StepBody({ step, live, businessName }: { step: Step; live: boolean; businessName: string | null }) {
  const business = await getBusiness((await appDb()));
  switch (step) {
    case "wallet":
      return (
        <div className="space-y-4 text-muted">
          <p>
            Your wallet is how Bursr knows it&apos;s you. Only your wallet can change your limits or who gets paid; your agent never can. Connecting is free and moves no money.
          </p>
          <p className="text-sm">
            No wallet yet? Install a NEAR wallet app such as HOT Wallet, create an account, then come back here.
          </p>
          <ConnectWallet />
        </div>
      );

    case "business":
      return (
        <ActionForm action={onboardBusinessAction} submit="Save and continue" className="max-w-lg space-y-5">
          <label className="block text-sm font-medium">
            Business name
            <input name="name" defaultValue={businessName ?? ""} required minLength={2} placeholder="e.g. Mama's Kitchen" className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2" />
          </label>
          <TimeZoneField current={business?.rules.timeZone ?? null} />
          <label className="block text-sm font-medium">
            Payday <span className="font-normal text-muted">(when weekly pay goes out)</span>
            <select name="payday" defaultValue={business?.rules.paydayWeekday ?? 5} className="mt-1 block w-full rounded-lg border border-line bg-card px-3 py-2">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  Every {d}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      );

    case "limits":
      return (
        <div className="space-y-4">
          <p className="text-muted">
            These limits are locked into your agent&apos;s wallet. Any payment that breaks them is stopped by the wallet itself, whatever the agent tries. Start small; you can raise them any time.
          </p>
          <LimitsForm rules={business!.rules} tokens={await payoutTokens()} />
        </div>
      );

    case "people": {
      const [payees, invites] = await Promise.all([listPayees((await appDb())), listInvites((await appDb()))]);
      const rules = business!.rules;
      return (
        <div className="space-y-8">
          <p className="text-muted">Add the staff and suppliers your agent will pay. Don&apos;t know their wallet address? Send them a link and they fill it in; you approve it.</p>

          {payees.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {payees.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted">
                    {p.payout.token.symbol} on {chainName(p.payout.token.chain)}
                    {p.recurring && ` · ${formatUsd(BigInt(p.recurring.amountUsd))} ${scheduleWords(p.recurring, rules.paydayWeekday)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <InvitesList invites={invites} />

          <div className="rounded-lg border border-line p-5">
            <h2 className="font-semibold">Send someone an invite link</h2>
            <div className="mt-4">
              <InviteForm />
            </div>
          </div>

          <details className="rounded-lg border border-line p-5">
            <summary className="cursor-pointer font-semibold">I have their wallet address</summary>
            <ActionForm action={addPayeeAction} submit="Add them" className="mt-4 space-y-5">
              <DetailFields />
              <PayoutFields tokens={rules.payoutTokens} />
            </ActionForm>
          </details>

          <ActionForm action={onboardNextAction} submit={payees.length ? "Continue" : "Skip for now"} tone={payees.length ? "primary" : "quiet"}>
            <input type="hidden" name="step" value="people" />
          </ActionForm>
        </div>
      );
    }

    case "agent": {
      if (!live) {
        return (
          <div className="space-y-4 text-muted">
            <p>
              In live mode your wallet now confirms twice: once to create your agent&apos;s own wallet with your limits and people locked in, once to let the agent pay inside them. Both
              are free. In practice mode the wallet is simulated.
            </p>
            <ActionForm action={onboardNextAction} submit="Turn on my agent">
              <input type="hidden" name="step" value="agent" />
            </ActionForm>
          </div>
        );
      }
      const owner = await getOwner();
      const record = await getAccountRecord((await appDb()));
      const grant = grantState(record);
      return (
        <div className="space-y-4">
          <p className="text-muted">
            Your agent gets its own wallet, separate from yours, with your limits and the people you pay locked into it. Your wallet app asks you to confirm twice. Both are free and
            move no money.
          </p>
          <WalletPanel
            onboarding
            ownerAccountId={owner?.accountId ?? null}
            businessExists
            businessOwner={business!.ownerAccountId}
            agentId={record?.agentId ?? null}
            needsSigning={await policyNeedsSigning((await appDb()))}
            hasGrant={grant.usable}
            grantRenewBy={null}
            frozen={business!.rules.frozen}
          />
        </div>
      );
    }

    case "money":
      return (
        <div className="space-y-5">
          <p className="text-muted">Your agent pays from its own wallet, never from yours. Put in enough for the first payday; it tells you when the money arrives and when it&apos;s running low.</p>
          {live ? (
            <AddMoney suggestedUsd={null} />
          ) : (
            <ActionForm action={practiceMoneyAction} submit="Add $500 of practice money">
              <input type="hidden" name="amount" value="500" />
            </ActionForm>
          )}
          <ActionForm action={onboardNextAction} submit="Continue" tone="quiet">
            <input type="hidden" name="step" value="money" />
          </ActionForm>
        </div>
      );

    case "done": {
      const next = (await comingUp((await appDb()))).slice(0, 5);
      return (
        <div className="space-y-5">
          <p className="text-lg">Your agent is on. From now on it pays your people on their day and tells you what it did.</p>
          {next.length > 0 ? (
            <div className="rounded-lg border border-line p-4">
              <p className="font-medium">First up</p>
              <ul className="mt-2 space-y-1 text-sm">
                {next.map((u, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {new Date(`${u.dueOn}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })} · {u.payeeName} ({u.forWhat})
                    </span>
                    <span className="num">{formatUsd(u.amountUsd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted">Nothing is scheduled yet. Add regular pay to someone, or send in an invoice, and your agent takes it from there.</p>
          )}
          <p className="text-sm text-muted">
            Want messages on your phone? Connect Telegram later from <Link href="/spending-rules" className="text-indigo underline">Spending rules</Link>.
          </p>
          <ActionForm action={onboardNextAction} submit="Go to my dashboard">
            <input type="hidden" name="step" value="finished" />
          </ActionForm>
        </div>
      );
    }
  }
}
