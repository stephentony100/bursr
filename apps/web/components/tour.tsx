"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { PALETTE } from "@/lib/palette";

// A short guided tour of Home for new owners: it spotlights each part in turn
// with one or two plain sentences. It starts by itself the first time (kept
// per device), and "Take the tour" replays it (/this-week?tour=1). Steps whose
// part isn't on screen (an empty "Needs you", a phone without the sidebar)
// are skipped. Built on driver.js (MIT).

const KEY = "bursr:tour-done";

/** The first matching element that is actually visible (sidebar on desktop, tabs on phones). */
function visible(...names: string[]): Element | undefined {
  for (const name of names) {
    const el = [...document.querySelectorAll(`[data-tour="${name}"]`)].find((e) => e.getClientRects().length > 0);
    if (el) return el;
  }
  return undefined;
}

type Step = { at?: string[]; title: string; body: string; side?: "top" | "bottom" | "left" | "right" };

const STEPS: Step[] = [
  { title: "Welcome to Bursr", body: "Your agent runs payroll for you: staff, suppliers and invoices. Here's a one-minute tour of Home." },
  { at: ["balance"], title: "Your Bursr wallet", body: "Your agent pays everyone from here. Tap the eye to hide the amount.", side: "bottom" },
  { at: ["limit"], title: "Left this week", body: "Your weekly limit. Your wallet refuses anything past it, whatever the AI asks.", side: "bottom" },
  { at: ["add-money"], title: "Add money", body: "Top up from your own wallet, or from any network.", side: "top" },
  { at: ["pay-someone"], title: "Pay someone", body: "A quick job or a repair? Pay them once, inside your limits.", side: "top" },
  { at: ["ask-agent"], title: "Ask your agent", body: "Ask what you paid, or tell it who to pay. Nothing moves until you confirm.", side: "top" },
  { at: ["agent"], title: "What your agent is doing", body: "Its latest step, live. Tap to see everything it did.", side: "bottom" },
  { at: ["needs-you"], title: "Needs you", body: "Only the unusual lands here: someone new, a big payment, one that failed.", side: "bottom" },
  { at: ["payday"], title: "Next payday", body: "When your agent pays next, and anything waiting for your OK.", side: "left" },
  { at: ["recent"], title: "Recent payments", body: "Every payment as it happens: who, how much, and whether it arrived.", side: "top" },
  { at: ["nav-people"], title: "People", body: "Add staff and suppliers one by one, with a link they fill in, or from a spreadsheet.", side: "right" },
  { at: ["nav-invoices"], title: "Invoices", body: "Send supplier invoices here. Your agent checks every one before paying.", side: "right" },
  { at: ["nav-limits", "nav-more"], title: "Limits", body: "Your limits and the emergency stop. Only your own wallet can change them.", side: "right" },
  { title: "You're all set", body: "Your agent takes it from here. Replay this tour any time from the menu." },
];

export function startTour(onDone?: () => void) {
  const steps: DriveStep[] = STEPS.flatMap((s) => {
    // The first step has nothing to go back to.
    if (!s.at) return [{ popover: { title: s.title, description: s.body, ...(s === STEPS[0] ? { showButtons: ["next", "close"] as ("next" | "close")[] } : {}) } }];
    const el = visible(...s.at);
    return el ? [{ element: el, popover: { title: s.title, description: s.body, side: s.side, align: "start" as const } }] : [];
  });
  const tour = driver({
    steps,
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Done",
    popoverClass: "bursr-tour",
    overlayColor: PALETTE.ink,
    overlayOpacity: 0.55,
    stagePadding: 3,
    stageRadius: 16,
    smoothScroll: true,
    allowClose: true,
    onDestroyed: () => {
      try {
        localStorage.setItem(KEY, "1");
      } catch {
        /* private mode: it may show again next time */
      }
      onDone?.();
    },
  });
  tour.drive();
}

/** Starts the tour on Home the first time, or when asked with ?tour=1. */
export function Tour() {
  const params = useSearchParams();
  const router = useRouter();
  const asked = params.get("tour") === "1";
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      seen = true; // can't remember it, so don't show it on every visit
    }
    if (!asked && seen) return;
    // Let the page settle (fonts, the balance card) before measuring.
    const t = setTimeout(() => startTour(() => asked && router.replace("/this-week")), 700);
    return () => clearTimeout(t);
  }, [asked, router]);
  return null;
}
