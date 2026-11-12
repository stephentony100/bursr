import type { ActionCard, ChatTurn } from "./agent/chat";
import type { PrismaClient } from "./generated/prisma/client";

// The owner's conversation with the agent, saved per business so it survives
// leaving the page or switching devices. Card tokens are the signed proposals
// from lib/agent/chat.ts; confirming one records what happened.

export interface SavedLine extends ChatTurn {
  id: string;
  cards?: ActionCard[];
  done?: Record<string, string>;
}

const KEEP = 60;

export async function chatHistory(db: PrismaClient): Promise<SavedLine[]> {
  const rows = await db.chatMessage.findMany({ orderBy: { at: "desc" }, take: KEEP });
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role as ChatTurn["role"],
    content: r.content,
    ...(r.cards ? { cards: JSON.parse(r.cards) as ActionCard[] } : {}),
    ...(r.done ? { done: JSON.parse(r.done) as Record<string, string> } : {}),
  }));
}

export async function saveChatTurn(db: PrismaClient, role: ChatTurn["role"], content: string, cards?: ActionCard[]) {
  await db.chatMessage.create({ data: { role, content: content.slice(0, 4000), cards: cards?.length ? JSON.stringify(cards) : null } });
}

/** Records the result of a confirmed card on the reply that offered it. */
export async function markCardDone(db: PrismaClient, token: string, message: string) {
  const rows = await db.chatMessage.findMany({ where: { cards: { contains: token } }, orderBy: { at: "desc" }, take: 1 });
  const row = rows[0];
  if (!row) return;
  const done = { ...(row.done ? (JSON.parse(row.done) as Record<string, string>) : {}), [token]: message };
  await db.chatMessage.update({ where: { id: row.id }, data: { done: JSON.stringify(done) } });
}

export async function clearChat(db: PrismaClient) {
  await db.chatMessage.deleteMany({});
}
