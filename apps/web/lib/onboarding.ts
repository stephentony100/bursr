import { readEnv } from "./env";
import type { PrismaClient } from "./generated/prisma/client";
import { grantState } from "./grant-store";
import type { OwnerSession } from "./owner";
import { policyNeedsSigning } from "./owner-actions";
import { getAccountRecord, getBusiness } from "./store";

// The new-owner flow (/welcome). Where an owner is in it is worked out from
// what exists (signed in? business? agent wallet and its pass?) plus a few
// "seen" marks for the steps that can be skipped (limits, people, money).

export const STEPS = ["wallet", "business", "limits", "people", "agent", "money", "done"] as const;
export type Step = (typeof STEPS)[number];

export const STEP_TITLES: Record<Step, string> = {
  wallet: "Connect your wallet",
  business: "Your business",
  limits: "Your limits",
  people: "Who you pay",
  agent: "Turn on your agent",
  money: "Add money",
  done: "All set",
};

const KEY = "onboarding";
type Marks = Partial<Record<"limits" | "people" | "agent" | "money" | "finished", true>>;

async function marks(db: PrismaClient): Promise<Marks> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  return row ? (JSON.parse(row.value) as Marks) : {};
}

export async function markOnboarding(db: PrismaClient, mark: keyof Marks) {
  const m = { ...(await marks(db)), [mark]: true };
  await db.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(m) }, create: { key: KEY, value: JSON.stringify(m) } });
}

export async function clearOnboarding(db: PrismaClient) {
  await db.setting.deleteMany({ where: { key: KEY } });
}

export interface OnboardingState {
  /** The first step not done yet. */
  current: Step;
  done: Record<Step, boolean>;
  finished: boolean;
  live: boolean;
}

export async function onboardingState(db: PrismaClient, owner: OwnerSession | null): Promise<OnboardingState> {
  const live = readEnv().BURSAR_MODE === "live";
  const [business, m, record] = await Promise.all([getBusiness(db), marks(db), getAccountRecord(db)]);
  const agentOn = live ? Boolean(record) && !(await policyNeedsSigning(db)) && grantState(record).usable : Boolean(m.agent);
  const done: Record<Step, boolean> = {
    wallet: Boolean(owner),
    business: Boolean(business),
    limits: Boolean(business && m.limits),
    people: Boolean(business && m.people),
    agent: Boolean(business && agentOn),
    money: Boolean(business && m.money),
    done: Boolean(m.finished),
  };
  const current = STEPS.find((s) => !done[s]) ?? "done";
  return { current, done, finished: Boolean(m.finished), live };
}
