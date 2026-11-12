"use client";

import { CheckCircle, ShieldWarning } from "@phosphor-icons/react";
import Image from "next/image";
import { useRef } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

// The hero's signature: payday playing out live. A phone runs Bursr's Home
// screen; as each row turns from "Paying" to "Paid", that person's
// "received" card lands beside the phone, each on their own network. One
// look-alike supplier is stopped. Built from the sample restaurant's data;
// a static final frame when the visitor prefers reduced motion.

export interface Person {
  name: string;
  role: string;
  amount: string;
  network: string;
  token: string;
  photo?: string;
  /** Where the face sits in the photo (CSS object-position). */
  focus?: string;
}

const PEOPLE: Person[] = [
  { name: "Bisi Adeyemi", role: "Head chef", amount: "$220.00", network: "Base", token: "USDC", photo: "/photos/chef-abuja.jpg", focus: "53% 14%" },
  { name: "Mama Put Farms", role: "Tomatoes & pepper", amount: "$118.00", network: "NEAR", token: "USDC", photo: "/photos/tomatoes-ibadan.jpg", focus: "44% 44%" },
  { name: "Tunde Okafor", role: "Grill cook", amount: "$110.00", network: "Tron", token: "USDT", photo: "/photos/jollof-lagos.jpg", focus: "57% 24%" },
  { name: "Amaka Eze", role: "Cashier", amount: "$120.00", network: "Solana", token: "USDC", photo: "/photos/vendor-phone.jpg", focus: "55% 32%" },
];

const initials = (n: string) =>
  n
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

function Face({ p, size = 36 }: { p: Person; size?: number }) {
  return p.photo ? (
    <Image src={p.photo} alt="" width={size} height={size} sizes={`${size * 2}px`} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, objectPosition: p.focus }} />
  ) : (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-ledger-soft text-xs font-bold text-ledger" style={{ width: size, height: size }}>
      {initials(p.name)}
    </span>
  );
}

/** Where each "received" card sits around the phone (desktop). */
const SPOTS = ["left-0 top-[1%]", "right-0 top-[16%]", "left-[2%] bottom-[22%]", "right-[1%] bottom-[10%]"];

export function Payday({ people = PEOPLE }: { people?: Person[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      if (prefersReducedMotion()) {
        gsap.set(q("[data-status=paid]"), { autoAlpha: 1 });
        gsap.set(q("[data-status=paying]"), { autoAlpha: 0 });
        gsap.set(q("[data-card]"), { autoAlpha: 1, y: 0, scale: 1 });
        return;
      }
      // Entrance: the phone rises in (Chainrails' hero: y 7.5rem, scale up, 1s power2.out).
      gsap.from(q("[data-phone]"), { y: "7.5rem", scale: 0.9, autoAlpha: 0, duration: 1, ease: "power2.out" });
      // Received cards bob gently while they're shown.
      gsap.to(q("[data-float]"), { y: "+=6", duration: 2.5, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: { each: 0.4 } });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: 0.6, defaults: { ease: "power3.out" } });
      tl.set(q("[data-status=paid]"), { autoAlpha: 0 })
        .set(q("[data-status=paying]"), { autoAlpha: 1 })
        .set(q("[data-card]"), { autoAlpha: 0, y: 18, scale: 0.94 })
        .set(q("[data-blocked]"), { autoAlpha: 0, x: 0 })
        .set(q("[data-balance]"), { textContent: "5,992.66" })
        .fromTo(q("[data-row]"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.5 }, 0.2);

      people.forEach((_, i) => {
        const at = 1 + i * 1.1;
        tl.to(q(`[data-row="${i}"] [data-status=paying]`), { autoAlpha: 0, duration: 0.2 }, at)
          .to(q(`[data-row="${i}"] [data-status=paid]`), { autoAlpha: 1, duration: 0.25 }, at + 0.05)
          .fromTo(q(`[data-row="${i}"]`), { backgroundColor: "rgba(18,161,80,0.10)" }, { backgroundColor: "rgba(18,161,80,0)", duration: 0.9 }, at)
          .to(q(`[data-card="${i}"]`), { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.6)" }, at + 0.1);
      });
      const balances = ["5,772.66", "5,654.66", "5,544.66", "5,424.66"];
      balances.forEach((b, i) => tl.set(q("[data-balance]"), { textContent: b }, 1 + i * 1.1 + 0.05));

      const blockAt = 1 + people.length * 1.1;
      tl.to(q("[data-blocked]"), { autoAlpha: 1, duration: 0.3 }, blockAt)
        .fromTo(q("[data-blocked]"), { x: 0 }, { keyframes: { x: [-8, 7, -5, 3, 0] }, duration: 0.45, ease: "none" }, blockAt + 0.1)
        .to({}, { duration: 2.6 })
        .to(q("[data-card], [data-blocked]"), { autoAlpha: 0, y: -10, duration: 0.4, stagger: 0.04, ease: "power2.in" });
    },
    { scope: root },
  );

  return (
    <figure ref={root} aria-label="Payday on Bursr: four people paid on their own networks, one look-alike supplier blocked" className="relative mx-auto h-[600px] w-full max-w-[640px] select-none">

      {/* Phone */}
      <div data-phone className="absolute left-1/2 top-1/2 w-[272px] -translate-x-1/2 -translate-y-1/2 rounded-[44px] bg-ink p-[9px] shadow-[0_40px_80px_-30px_rgba(14,18,34,0.55)]">
        <div className="relative overflow-hidden rounded-[36px] bg-paper">
          <div aria-hidden className="absolute left-1/2 top-2 z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-ink" />
          <div className="px-4 pb-5 pt-10">
            <p className="text-[10px] text-muted">Good morning</p>
            <p className="font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-tight">Bukka Corner</p>
            <div className="mt-3 rounded-[18px] bg-night p-3.5 text-white">
              <p className="flex items-center justify-between text-[9px] text-white/70">
                Wallet balance
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok-bright" /> Agent working
                </span>
              </p>
              <p className="num mt-1 font-[family-name:var(--font-display)] text-[26px] font-extrabold tracking-tight">
                $<span data-balance>5,424.66</span>
              </p>
              <div className="mt-2 h-1 rounded-full bg-white/15">
                <div className="h-1 w-2/5 rounded-full bg-white" />
              </div>
            </div>
            <p className="mt-4 text-[11px] font-bold">Paying today</p>
            <ul className="mt-1.5 space-y-0.5">
              {people.map((p, i) => (
                <li key={p.name} data-row={i} className="flex items-center gap-2 rounded-xl px-1.5 py-1.5">
                  <Face p={p} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold">{p.name}</span>
                    <span className="block truncate text-[9px] text-muted">
                      {p.role} · {p.network}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-[11px] font-semibold">{p.amount}</span>
                    <span className="relative block h-3 w-12 text-[9px] font-semibold">
                      <span data-status="paying" className="invisible absolute right-0 text-ledger opacity-0">
                        Paying…
                      </span>
                      <span data-status="paid" className="absolute right-0 text-ok">
                        Paid
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* "Received" cards, one per person, on their own network */}
      {people.map((p, i) => (
        <div key={p.name} data-card={i} aria-hidden className={`absolute hidden sm:block ${SPOTS[i]}`}>
          <div
          data-float
          className={`w-[208px] rounded-2xl border border-line bg-card/95 p-3 shadow-[0_18px_40px_-18px_rgba(14,18,34,0.35)] backdrop-blur`}
          >
          <div className="flex items-center gap-2.5">
            <Face p={p} />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{p.name}</p>
              <p className="text-[10px] text-muted">{p.role}</p>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[13px] font-bold">
            <CheckCircle size={16} weight="fill" className="text-ok" aria-hidden />
            <span className="num">+{p.amount}</span>
            <span className="text-[10px] font-medium text-muted">received</span>
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/networks/${p.network.toLowerCase()}.svg`} alt="" width={14} height={14} className="h-3.5 w-3.5" />
            {p.token} on {p.network}
          </p>
          </div>
        </div>
      ))}

      {/* The one that doesn't get paid */}
      <div
        data-blocked
        aria-hidden
        className="absolute bottom-[-2%] left-1/2 w-[290px] -translate-x-1/2 rounded-2xl border border-refuse/30 bg-card p-3 shadow-[0_18px_40px_-18px_rgba(217,45,32,0.45)]"
      >
        <p className="flex items-center gap-2 text-xs font-bold text-refuse">
          <ShieldWarning size={16} weight="fill" aria-hidden /> Blocked: Ek0 Fresh Foods · $285.00
        </p>
        <p className="mt-0.5 text-[11px] text-muted">Looks like Eko Fresh Foods, but isn&apos;t. Not paid.</p>
      </div>
    </figure>
  );
}
