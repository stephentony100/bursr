import { db } from "../db";
import { readEnv } from "../env";
import { runAgent } from "./engine";

// Keeps Bursar's agent working while the app runs: a run shortly after start,
// then every minute, and every few seconds while payments are on their way
// (so the owner sees "received" soon after it happens). Owner actions call
// `kickAgent()` so the agent reacts at once instead of on the next minute.

const EVERY_MS = 60_000;
const FOLLOW_MS = 8_000;
const g = globalThis as unknown as { bursarAgentTimer?: ReturnType<typeof setInterval>; bursarAgentFollow?: ReturnType<typeof setTimeout> };

const off = () => readEnv().BURSAR_AGENT === "off";

async function runAndFollow() {
  try {
    await runAgent();
    const moving = await db().planItem.count({ where: { payStatus: { in: ["sent", "paying"] } } });
    if (moving > 0) followUp();
  } catch (e) {
    console.error("[bursar agent]", e instanceof Error ? e.message : e);
  }
}

function followUp() {
  if (g.bursarAgentFollow) return;
  g.bursarAgentFollow = setTimeout(() => {
    g.bursarAgentFollow = undefined;
    void runAndFollow();
  }, FOLLOW_MS);
}

export function startAgentLoop() {
  if (g.bursarAgentTimer || off()) return;
  g.bursarAgentTimer = setInterval(() => void runAndFollow(), EVERY_MS);
  setTimeout(() => void runAndFollow(), 5_000);
}

/** Wake the agent now (fire and forget). */
export function kickAgent() {
  if (off()) return;
  setTimeout(() => void runAndFollow(), 0);
}

/** After the owner ran the agent directly: keep following the payments it sent. */
export function followPayments() {
  if (!off()) followUp();
}
