import type { ReactNode } from "react";
import type { Tone } from "@/components/ui/badge";

// The four checks Bursr runs on every invoice, each with its example from
// the sample week. Shown on the home page's checks section.

export interface Catch {
  title: string;
  tone: Tone;
  outcome: string;
  line: string;
  show: ReactNode;
}

function Field({ label, children, flagged = false }: { label: string; children: ReactNode; flagged?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card px-4 py-3 text-ink ${flagged ? "border-refuse/40" : "border-line"}`}>
      <p className={`text-xs font-medium ${flagged ? "text-refuse" : "text-muted"}`}>{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function InvoiceRow({ day, flagged = false }: { day: string; flagged?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 text-sm text-ink ${flagged ? "border-hold/50" : "border-line"}`}>
      <div>
        <p className="font-medium">Mama Put Farms Ltd · #MPF-0412</p>
        <p className="text-xs text-muted">{day}</p>
      </div>
      <span className="num font-medium">$118.00</span>
    </div>
  );
}

export function catches(usualAddress: string, newAddress: string): Catch[] {
  return [
    {
      title: "Look-alike names",
      tone: "block",
      outcome: "Blocked: not paid",
      line: "A zero where an O should be is easy to miss at the end of a long day. Bursr compares every name with the people you pay.",
      show: (
        <div className="space-y-2">
          <Field label="On your list">
            <p className="text-xl font-semibold">Eko Fresh Foods</p>
          </Field>
          <Field label="On this invoice" flagged>
            <p className="text-xl font-semibold">
              Ek<mark className="rounded bg-refuse-soft px-0.5 text-refuse underline decoration-2 underline-offset-4">0</mark> Fresh Foods
            </p>
          </Field>
        </div>
      ),
    },
    {
      title: "The same bill twice",
      tone: "hold",
      outcome: "Held: waits for you",
      line: "Same supplier, same number, same amount, sent again on Wednesday. Paid once is enough.",
      show: (
        <div className="space-y-2">
          <InvoiceRow day="Arrived Monday" />
          <InvoiceRow day="Arrived Wednesday · same number, same amount" flagged />
        </div>
      ),
    },
    {
      title: "Changed bank details",
      tone: "block",
      outcome: "Blocked: not paid",
      line: "“Pay our new account, today” is the oldest trick there is. Only you can change where someone gets paid, and new details wait 48 hours.",
      show: (
        <div className="space-y-2">
          <Field label="Where Eko Fresh Foods gets paid (set by you)">
            <p className="num break-all text-sm">{usualAddress}</p>
          </Field>
          <Field label="This invoice says pay" flagged>
            <p className="num break-all text-sm text-refuse">{newAddress}</p>
            <p className="mt-2 text-sm italic text-muted">“Our bank details have changed. Pay today or your supply will be stopped.”</p>
          </Field>
        </div>
      ),
    },
    {
      title: "Prices creeping up",
      tone: "hold",
      outcome: "Held: waits for you",
      line: "Bursr knows the prices you agreed and holds anything more than 5% over. Six crates at $23.40 is $32.40 more than you agreed.",
      show: (
        <Field label="Tomatoes (crate) · invoice #MPF-0419">
          <div className="mt-2 space-y-3 text-sm">
            <div>
              <p className="flex justify-between">
                <span className="text-muted">Agreed</span>
                <span className="num">$18.00</span>
              </p>
              <div className="mt-1.5 h-2 rounded-full bg-ledger" style={{ width: `${(1800 / 2340) * 100}%` }} />
            </div>
            <div>
              <p className="flex justify-between">
                <span className="text-muted">Billed (30% more)</span>
                <span className="num text-hold">$23.40</span>
              </p>
              <div className="mt-1.5 h-2 w-full rounded-full bg-hold" />
            </div>
          </div>
        </Field>
      ),
    },
  ];
}
