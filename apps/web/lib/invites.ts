import { randomBytes } from "node:crypto";
import { z } from "zod";
import { addressProblem } from "./address";
import { normaliseAddress, PayeeCategory, PayeeSchema, type Payout, type PayoutToken } from "./domain";
import type { PrismaClient } from "./generated/prisma/client";
import { addPayee, NotOwnerError } from "./owner-actions";
import type { OwnerSession } from "./owner";
import { getBusiness } from "./store";
import { scoped } from "./tenant";

// Invites: the owner sends a link; the person chooses how they want to be paid
// and gives their address. Nothing is payable until the owner approves what
// they sent (and, in live mode, signs the new payee list into the account).
// The person can only fill in their own invite, once, before it expires.

const INVITE_DAYS = 7;
const Recurring = PayeeSchema.shape.recurring;

export interface InviteView {
  id: string;
  token: string;
  name: string;
  category: z.infer<typeof PayeeCategory>;
  recurring: z.infer<typeof Recurring>;
  status: "open" | "submitted" | "approved" | "declined";
  createdAt: Date;
  expiresAt: Date;
  payout: Payout | null;
  submittedAt: Date | null;
}

type Row = NonNullable<Awaited<ReturnType<PrismaClient["payeeInvite"]["findUnique"]>>>;
function view(r: Row): InviteView {
  return {
    id: r.id,
    token: r.token,
    name: r.name,
    category: PayeeCategory.parse(r.category),
    recurring: Recurring.parse(JSON.parse(r.recurring)),
    status: r.status as InviteView["status"],
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    payout: r.payout ? (JSON.parse(r.payout) as Payout) : null,
    submittedAt: r.submittedAt,
  };
}

async function assertOwner(db: PrismaClient, owner: OwnerSession) {
  const business = await getBusiness(db);
  if (!business || business.ownerAccountId !== owner.accountId) throw new NotOwnerError();
  return business;
}

export async function createInvite(
  db: PrismaClient,
  owner: OwnerSession,
  input: { name: string; category: z.infer<typeof PayeeCategory>; recurring: z.infer<typeof Recurring> },
  now = new Date(),
): Promise<InviteView> {
  await assertOwner(db, owner);
  const name = input.name.trim();
  if (!name) throw new Error("Add their name.");
  const row = await db.payeeInvite.create({
    data: {
      token: randomBytes(18).toString("base64url"),
      name: name.slice(0, 80),
      category: PayeeCategory.parse(input.category),
      recurring: JSON.stringify(Recurring.parse(input.recurring)),
      expiresAt: new Date(now.getTime() + INVITE_DAYS * 24 * 60 * 60_000),
    },
  });
  await db.auditEvent.create({ data: { kind: "invite_created", actor: owner.accountId, message: `You invited ${name} to share how they want to be paid` } });
  return view(row);
}

export async function listInvites(db: PrismaClient): Promise<InviteView[]> {
  const rows = await db.payeeInvite.findMany({ where: { status: { in: ["open", "submitted"] } }, orderBy: { createdAt: "asc" } });
  return rows.map(view);
}

// --- the invited person's side (no sign-in: the link is the key) --------------

export interface PublicInvite {
  businessName: string;
  name: string;
  state: "open" | "sent" | "closed";
  tokens: PayoutToken[];
}

/** `db` is the unscoped database: the link itself says which business it belongs to. */
export async function publicInvite(db: PrismaClient, token: string, now = new Date()): Promise<PublicInvite | null> {
  const row = await db.payeeInvite.findUnique({ where: { token } });
  const business = row ? await getBusiness(scoped(db, row.businessId)) : null;
  if (!row || !business) return null;
  const state = row.status === "open" && row.expiresAt > now ? "open" : row.status === "submitted" ? "sent" : "closed";
  return { businessName: business.name, name: row.name, state, tokens: business.rules.payoutTokens };
}

export async function submitInvite(raw: PrismaClient, token: string, input: { assetId: string; address: string; memo: string }, now = new Date()) {
  const found = await raw.payeeInvite.findUnique({ where: { token } });
  const db = scoped(raw, found?.businessId ?? "none");
  const row = found;
  const business = await getBusiness(db);
  if (!row || !business || row.status !== "open" || row.expiresAt <= now) throw new Error("This link has expired or was already used. Ask for a new one.");
  const tokenChoice = business.rules.payoutTokens.find((t) => t.assetId === input.assetId);
  if (!tokenChoice) throw new Error("Pick how you want to be paid.");
  const problem = addressProblem(tokenChoice.chain, input.address);
  if (problem) throw new Error(problem.replace("Check it with the payee.", "Please check it."));
  const payout: Payout = { token: tokenChoice, address: normaliseAddress(input.address), memo: input.memo.trim() || null };
  // Only an open invite can be filled in, and only once.
  const done = await db.payeeInvite.updateMany({ where: { id: row.id, status: "open" }, data: { status: "submitted", payout: JSON.stringify(payout), submittedAt: now } });
  if (done.count !== 1) throw new Error("This link was already used.");
  await db.auditEvent.create({
    data: { kind: "invite_submitted", actor: "invitee", message: `${row.name} sent how they want to be paid (${tokenChoice.symbol} on ${tokenChoice.chain}). It waits for your OK.` },
  });
}

// --- the owner decides -------------------------------------------------------

export async function approveInvite(db: PrismaClient, owner: OwnerSession, id: string): Promise<string> {
  await assertOwner(db, owner);
  const row = await db.payeeInvite.findUnique({ where: { id } });
  if (!row || row.status !== "submitted" || !row.payout) throw new Error("There's nothing to approve on this invite.");
  const v = view(row);
  const payeeId = await addPayee(db, owner, { name: v.name, category: v.category, payout: v.payout!, prices: [], recurring: v.recurring });
  await db.payeeInvite.update({ where: { id }, data: { status: "approved", payeeId } });
  return payeeId;
}

export async function declineInvite(db: PrismaClient, owner: OwnerSession, id: string) {
  await assertOwner(db, owner);
  await db.payeeInvite.updateMany({ where: { id, status: { in: ["open", "submitted"] } }, data: { status: "declined" } });
}
