import type { Payee, Rules } from "./domain";

// When a payment is due, as calendar dates ("YYYY-MM-DD") in the business's
// own time zone. Pure functions: the agent asks "what is due by today?" every
// time it wakes, and the owner's "get payments ready" asks "by next payday?".

export type Recurring = NonNullable<Payee["recurring"]>;
type Day = string; // YYYY-MM-DD

const MS_DAY = 24 * 60 * 60 * 1000;
const toUtc = (d: Day) => Date.parse(`${d}T00:00:00Z`);
const fromUtc = (ms: number): Day => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: Day, n: number): Day => fromUtc(toUtc(d) + n * MS_DAY);
const weekday = (d: Day) => new Date(toUtc(d)).getUTCDay();
const daysInMonth = (d: Day) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate();

/** The calendar date it is now for the business. */
export function localDay(now: Date, timeZone: string): Day {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function isLastWorkingDay(d: Day): boolean {
  for (let n = 1; n <= 3; n++) {
    const next = addDays(d, n);
    if (next.slice(5, 7) !== d.slice(5, 7)) break;
    if (weekday(next) >= 1 && weekday(next) <= 5) return false;
  }
  return weekday(d) >= 1 && weekday(d) <= 5;
}

/** The first payday on or after a date. */
export function paydayOnOrAfter(d: Day, paydayWeekday: number): Day {
  return addDays(d, (paydayWeekday - weekday(d) + 7) % 7);
}

function isDueDay(r: Recurring, rules: Pick<Rules, "paydayWeekday">, d: Day, addedOn: Day): boolean {
  switch (r.every) {
    case "week":
      return weekday(d) === rules.paydayWeekday;
    case "two_weeks": {
      const anchor = r.startsOn ?? paydayOnOrAfter(addedOn, rules.paydayWeekday);
      const diff = Math.round((toUtc(d) - toUtc(anchor)) / MS_DAY);
      return diff >= 0 && diff % 14 === 0;
    }
    case "month":
      if (r.day === undefined) return weekday(d) === rules.paydayWeekday && Number(d.slice(8)) <= 7; // first payday of the month
      if (r.day === 0) return isLastWorkingDay(d);
      return Number(d.slice(8)) === Math.min(r.day, daysInMonth(d));
  }
}

/** The most recent due date on or before `today` (never before the payee was added); null if none. */
export function lastDueOn(r: Recurring, rules: Pick<Rules, "paydayWeekday">, addedOn: Day, today: Day): Day | null {
  for (let n = 0; n <= 62; n++) {
    const d = addDays(today, -n);
    if (d < addedOn) return null;
    if (isDueDay(r, rules, d, addedOn)) return d;
  }
  return null;
}

/** The next due date on or after `from`. */
export function nextDueOn(r: Recurring, rules: Pick<Rules, "paydayWeekday">, addedOn: Day, from: Day): Day | null {
  for (let n = 0; n <= 62; n++) {
    const d = addDays(from, n);
    if (d >= addedOn && isDueDay(r, rules, d, addedOn)) return d;
  }
  return null;
}

/** Plain words for a schedule: "every Friday", "on the 25th of each month"… */
export function scheduleWords(r: Recurring, paydayWeekday: number): string {
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][paydayWeekday];
  if (r.every === "week") return `every ${day}`;
  if (r.every === "two_weeks") return `every other ${day}`;
  if (r.day === undefined) return `on the first ${day} of each month`;
  if (r.day === 0) return "on the last working day of each month";
  const n = r.day;
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `on the ${n}${suffix} of each month`;
}

/**
 * When an invoice should be paid. "asap": the day it passed its checks.
 * "due": the day before its due date (overdue ones at once); no due date
 * printed: the first payday after it arrived.
 */
export function invoiceDueOn(
  inv: { receivedOn: Day; dueDate: string | null },
  rules: Pick<Rules, "paydayWeekday" | "invoiceTiming">,
): Day {
  if (rules.invoiceTiming === "asap") return inv.receivedOn;
  if (inv.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(inv.dueDate)) {
    const dayBefore = addDays(inv.dueDate, -1);
    return dayBefore < inv.receivedOn ? inv.receivedOn : dayBefore;
  }
  return paydayOnOrAfter(inv.receivedOn, rules.paydayWeekday);
}
