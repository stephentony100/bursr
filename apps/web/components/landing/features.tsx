"use client";

import { ArrowsClockwise, ChatCircleDots, CheckCircle, DownloadSimple, FileCsv, LockSimple, PaperPlaneTilt, ShieldCheck, UsersThree } from "@phosphor-icons/react";
import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

// What Bursr's agent does, one card per job, each with a small piece of the
// real product so the claim is shown, not just said.

function Card({ title, body, className = "", children }: { title: string; body: string; className?: string; children: React.ReactNode }) {
  return (
    <article data-feature className={`flex flex-col overflow-hidden rounded-[28px] border border-line bg-card ${className}`}>
      <div className="p-6 pb-0 sm:p-7 sm:pb-0">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">{title}</h3>
        <p className="mt-2 max-w-[46ch] text-muted">{body}</p>
      </div>
      <div className="mt-6 flex flex-1 items-end px-6 pb-6 sm:px-7 sm:pb-7">{children}</div>
    </article>
  );
}

const Row = ({ name, sub, amount, status }: { name: string; sub: string; amount: string; status: "Paid" | "Friday" }) => (
  <li className="flex items-center gap-3 py-2.5">
    <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-ledger-soft text-xs font-bold text-ledger">
      {name
        .split(" ")
        .map((w) => w[0])
        .join("")}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold">{name}</span>
      <span className="block text-xs text-muted">{sub}</span>
    </span>
    <span className="text-right">
      <span className="num block text-sm font-semibold">{amount}</span>
      <span className={`block text-xs font-semibold ${status === "Paid" ? "text-ok" : "text-muted"}`}>{status}</span>
    </span>
  </li>
);

export function Features() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(gsap.utils.toArray("[data-feature]", root.current), {
        y: 40,
        autoAlpha: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} id="features" aria-labelledby="features-title" className="bg-paper">
      <div className="mx-auto w-full max-w-7xl px-5 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-ledger">What your agent does</p>
          <h2 id="features-title" className="display mt-3 text-4xl leading-[1.05] sm:text-5xl">
            A payroll team of one, that never sleeps.
          </h2>
          <p className="mt-4 text-lg text-muted">Everything it takes to pay your people on time, without paying the wrong one.</p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" title="Payday on autopilot" body="Set each person's pay once: weekly, every two weeks or monthly. Your agent pays them on the day and tells you when it's done.">
            <ul className="w-full divide-y divide-line rounded-2xl border border-line px-4">
              <Row name="Bisi Adeyemi" sub="Head chef · every Friday" amount="$220.00" status="Paid" />
              <Row name="Amaka Eze" sub="Cashier · every Friday" amount="$120.00" status="Paid" />
              <Row name="Tunde Okafor" sub="Grill cook · every 2 weeks" amount="$110.00" status="Friday" />
            </ul>
          </Card>

          <Card title="Talk to it" body="Ask what you paid, or tell it who to pay. Nothing moves until you confirm.">
            <div className="w-full space-y-2 text-sm">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ledger px-3.5 py-2 text-white">Pay Bisi a $20 bonus for Sunday</p>
              <div className="w-[88%] rounded-2xl rounded-bl-md border border-line p-3">
                <p className="flex items-center gap-1.5 font-semibold">
                  <ChatCircleDots size={16} weight="fill" className="text-ledger" aria-hidden /> Pay Bisi Adeyemi $20.00
                </p>
                <p className="mt-2 w-fit rounded-full bg-ledger px-3 py-1 text-xs font-semibold text-white">Yes, pay it</p>
              </div>
            </div>
          </Card>

          <Card title="Reads every invoice" body="Send a photo or the text. Your agent checks it before a cent goes out.">
            <ul className="w-full space-y-2 text-sm">
              {["The supplier is really yours", "Not paid already", "Same bank details as before", "Prices as you agreed"].map((t) => (
                <li key={t} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
                  <CheckCircle size={16} weight="fill" className="text-ok" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Any network, full pay" body="USDC or USDT on the network each person uses. You cover the network fee, so they get every cent.">
            <div className="flex w-full flex-wrap gap-3">
              {[
                ["near", "NEAR"],
                ["base", "Base"],
                ["solana", "Solana"],
                ["tron", "Tron"],
                ["ethereum", "Ethereum"],
                ["arbitrum", "Arbitrum"],
                ["polygon", "Polygon"],
                ["optimism", "Optimism"],
              ].map(([n, name]) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={n} src={`/networks/${n}.svg`} alt={name} title={name} width={40} height={40} className="h-10 w-10 rounded-full bg-paper p-1.5" />
              ))}
            </div>
          </Card>

          <Card title="Limits it can't break" body="Your weekly limit, largest payment and approved people live in your wallet, not in the AI.">
            <div className="w-full rounded-2xl border border-line p-4">
              <p className="flex items-center justify-between text-sm">
                <span className="font-semibold">Weekly limit</span>
                <span className="num text-muted">$663 of $2,500</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-paper-2">
                <div className="h-2 w-[27%] rounded-full bg-ledger" />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-refuse">
                <LockSimple size={14} weight="bold" aria-hidden /> $5,000 to a stranger: refused by your wallet
              </p>
            </div>
          </Card>

          <Card title="Fixes problems itself" body="Low balance? It waits and pays when you top up. Network trouble? It tries again.">
            <ul className="w-full space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <ArrowsClockwise size={16} className="mt-0.5 shrink-0 text-hold" aria-hidden /> Waiting for money to pay Amaka ($120.00)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-ok" aria-hidden /> $500.00 arrived. Paid Amaka.
              </li>
            </ul>
          </Card>

          <Card className="lg:col-span-2" title="Your whole team in minutes" body="Upload a spreadsheet, or share one link in your staff group chat. Everyone fills in their own details, and you approve them all at once.">
            <div className="grid w-full gap-3 sm:grid-cols-3">
              {[
                { Icon: FileCsv, t: "Spreadsheet", s: "Up to 256 people" },
                { Icon: UsersThree, t: "Group link", s: "Approve all at once" },
                { Icon: PaperPlaneTilt, t: "Pay once", s: "A quick job, a repair" },
              ].map(({ Icon, t, s }) => (
                <div key={t} className="rounded-2xl bg-paper p-4">
                  <Icon size={22} className="text-ledger" aria-hidden />
                  <p className="mt-2 text-sm font-semibold">{t}</p>
                  <p className="text-xs text-muted">{s}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-3" title="Records and your money" body="Every payment with proof, ready for your accountant. Move money back to your own wallet any time.">
            <div className="flex w-full flex-wrap gap-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                <DownloadSimple size={16} aria-hidden /> Download CSV
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                <ShieldCheck size={16} aria-hidden /> Proof for each payment
              </span>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
