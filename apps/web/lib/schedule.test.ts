import { describe, expect, it } from "vitest";
import { invoiceDueOn, lastDueOn, localDay, nextDueOn, scheduleWords } from "./schedule";

const FRI = { paydayWeekday: 5 };
const amountUsd = "1000000";

describe("payment schedules", () => {
  it("weekly: every payday", () => {
    const r = { amountUsd, every: "week" as const };
    expect(lastDueOn(r, FRI, "2026-10-01", "2026-11-09")).toBe("2026-11-06"); // Monday → last Friday
    expect(nextDueOn(r, FRI, "2026-10-01", "2026-11-09")).toBe("2026-11-13");
    expect(lastDueOn(r, FRI, "2026-11-09", "2026-11-09")).toBeNull(); // never before the payee was added
  });

  it("every two weeks from the first payday after they were added, or a set start", () => {
    const r = { amountUsd, every: "two_weeks" as const };
    expect(nextDueOn(r, FRI, "2026-11-02", "2026-11-02")).toBe("2026-11-06");
    expect(nextDueOn(r, FRI, "2026-11-02", "2026-11-07")).toBe("2026-11-20");
    expect(nextDueOn({ ...r, startsOn: "2026-11-13" }, FRI, "2026-11-02", "2026-11-02")).toBe("2026-11-13");
  });

  it("monthly on a set day, clamped, or the last working day", () => {
    expect(nextDueOn({ amountUsd, every: "month", day: 25 }, FRI, "2026-10-01", "2026-11-09")).toBe("2026-11-25");
    expect(nextDueOn({ amountUsd, every: "month", day: 28 }, FRI, "2026-10-01", "2027-02-01")).toBe("2027-02-28");
    expect(nextDueOn({ amountUsd, every: "month", day: 0 }, FRI, "2026-10-01", "2026-10-01")).toBe("2026-10-30"); // 31 Oct 2026 is a Saturday
  });

  it("invoices: the day before the due date, at once if overdue, next payday without a date, or as soon as checked", () => {
    const rules = { ...FRI, invoiceTiming: "due" as const };
    expect(invoiceDueOn({ receivedOn: "2026-11-09", dueDate: "2026-11-20" }, rules)).toBe("2026-11-19");
    expect(invoiceDueOn({ receivedOn: "2026-11-09", dueDate: "2026-11-01" }, rules)).toBe("2026-11-09");
    expect(invoiceDueOn({ receivedOn: "2026-11-09", dueDate: null }, rules)).toBe("2026-11-13");
    expect(invoiceDueOn({ receivedOn: "2026-11-09", dueDate: "2026-11-20" }, { ...rules, invoiceTiming: "asap" })).toBe("2026-11-09");
  });

  it("uses the business's own calendar day and says the schedule in plain words", () => {
    expect(localDay(new Date("2026-11-09T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-10");
    expect(scheduleWords({ amountUsd, every: "month", day: 25 }, 5)).toBe("on the 25th of each month");
    expect(scheduleWords({ amountUsd, every: "two_weeks" }, 5)).toBe("every other Friday");
  });
});
