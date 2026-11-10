import { connection } from "next/server";
import { AgentFeed, AgentStatus, NeedsYouList } from "@/components/agent-panel";
import { AgentChat } from "@/components/agent-chat";
import { AutoRefresh } from "@/components/auto-refresh";
import { DEFAULT_CHAT_MODEL, QUICK_QUESTIONS } from "@/lib/agent/chat";
import { agentFeed, needsYou, nextPayday } from "@/lib/agent/view";
import { db } from "@/lib/db";
import { guardPage } from "@/lib/session";
import { readEnv } from "@/lib/env";
import { getBusiness } from "@/lib/store";

export default async function AgentPage() {
  await guardPage();
  await connection();
  const business = await getBusiness(db());
  if (!business) return <p className="text-muted">Set up your business first.</p>;
  const env = readEnv();
  const [feed, waiting] = await Promise.all([agentFeed(db(), 20), needsYou(db())]);
  const r = business.rules;
  return (
    <div className="space-y-6">
      <AutoRefresh active everyMs={5000} />
      <div>
        <h1 className="display text-4xl">Your agent</h1>
        <p className="mt-2 max-w-2xl text-muted">
          It pays your people on their day, fixes what it can by itself, and asks you about anything unusual. Talk to it here; every payment you ask for shows a card
          you confirm, and your limits still apply.
        </p>
      </div>
      <AgentStatus autopilot={r.autopilot} frozen={r.frozen} nextPayday={nextPayday(new Date(), r.timeZone, r.paydayWeekday)} />
      <NeedsYouList items={waiting} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AgentChat
          businessName={business.name}
          quickQuestions={QUICK_QUESTIONS}
          privateModel={env.NEAR_AI_API_KEY ? (env.NEAR_AI_CHAT_MODEL ?? DEFAULT_CHAT_MODEL) : null}
        />
        <AgentFeed entries={feed} />
      </div>
    </div>
  );
}
