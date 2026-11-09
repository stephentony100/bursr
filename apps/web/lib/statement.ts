import type { PrismaClient } from "./generated/prisma/client";
import { formatUnits, formatUsd } from "./money";
import { getPlan, type PlanItemView } from "./plans";
import { getBusiness } from "./store";
import { chainName } from "./tokens";

// The statement: one line per payment Bursar sent or tried to send. Because
// settlement is confidential, this is the owner's main record of what
// happened, so each line keeps the account's references.

export interface StatementLine {
  date: Date;
  payee: string;
  forWhat: string;
  amountUsd: bigint;
  sent: string;
  received: string;
  receivedAs: string;
  status: string;
  approval: string;
  planId: string;
  references: string;
  note: string;
}

const STATUS_WORDS: Record<PlanItemView["payStatus"], string> = {
  planned: "Not sent yet",
  paying: "Paying",
  waiting: "Waiting (the agent will try again)",
  sent: "Sent",
  delivered: "Paid",
  failed: "Not paid",
  refunded: "Returned to your wallet",
};

export async function statementLines(db: PrismaClient): Promise<StatementLine[]> {
  const business = await getBusiness(db);
  if (!business) return [];
  const treasury = business.rules.treasury;
  const plans = await db.plan.findMany({ where: { status: { in: ["approved", "done"] } }, orderBy: { approvedAt: "desc" }, select: { id: true } });
  const lines: StatementLine[] = [];
  for (const { id } of plans) {
    const plan = (await getPlan(db, id))!;
    for (const i of plan.items) {
      if (i.placement !== "in" || i.payStatus === "planned" || !i.payout) continue;
      const token = i.payout.token;
      lines.push({
        date: i.sentAt ?? plan.approvedAt ?? plan.createdAt,
        payee: i.payeeName,
        forWhat: i.forWhat,
        amountUsd: i.amountUsd,
        sent: i.amountSent !== null ? `${formatUnits(i.amountSent, treasury.decimals)} ${treasury.symbol} (${chainName(treasury.chain)})` : "",
        received: i.amountReceived !== null ? formatUnits(i.amountReceived, token.decimals) : "",
        receivedAs: `${token.symbol} on ${chainName(token.chain)} to ${i.payout.address}`,
        status: STATUS_WORDS[i.payStatus],
        approval:
          `Approved by ${plan.approvedBy ?? "?"} on ${plan.approvedAt?.toISOString().slice(0, 16).replace("T", " ") ?? "?"}` +
          (i.ownTapAt ? `; own OK ${i.ownTapAt.toISOString().slice(0, 16).replace("T", " ")}` : ""),
        planId: plan.id,
        references: i.references.join(" "),
        note: i.payReason ?? "",
      });
    }
  }
  return lines;
}

const CSV_HEADERS = ["Date (UTC)", "Paid to", "For", "Amount (USD)", "Sent from Bursar wallet", "They received", "Where it went", "Status", "Approved", "Payment list", "References", "Note"];

function cell(v: string): string {
  // Quote every cell; neutralise spreadsheet formulas (a value starting with = + - @).
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function statementCsv(lines: StatementLine[]): string {
  const rows = lines.map((l) => [
    l.date.toISOString().slice(0, 19).replace("T", " "),
    l.payee,
    l.forWhat,
    formatUsd(l.amountUsd).replace(/[$,]/g, ""),
    l.sent,
    l.received,
    l.receivedAs,
    l.status,
    l.approval,
    l.planId,
    l.references,
    l.note,
  ]);
  return [CSV_HEADERS, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
