import { db } from "../db";
import { readEnv } from "../env";
import { allBusinessIds, scoped } from "../tenant";
import { runAgent } from "./engine";

// Keeps every business's agent working while the app runs: a run shortly
// after start, then every minute, and every few seconds while payments are on
// their way (so the owner sees "received" soon after it happens). Owner
// actions call `kickAgent()` so the agent reacts at once.

const EVERY_MS = 60_000;
const FOLLOW_MS = 8_000;
const g = globalThis as unknown as { bursarAgentTimer?: ReturnType<typeof setInterval>; bursarAgentFollow?: ReturnType<typeof setTimeout> };

const off = () => readEnv().BURSAR_AGENT === "off";

async function runAndFollow() {
  try {
    for (const id of await allBusinessIds(db())) {
      // One business's trouble never stops the others.
      await runAgent(scoped(db(), id)).catch((e) => console.error(`[bursar agent ${id}]`, e instanceof Error ? e.message : e));
    }
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

/** Wake the agents now (fire and forget). */
export function kickAgent() {
  if (off()) return;
  setTimeout(() => void runAndFollow(), 0);
}

/** After an owner ran their agent directly: keep following the payments it sent. */
export function followPayments() {
  if (!off()) followUp();
}
