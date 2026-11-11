import { connection } from "next/server";
import { AgentFeed, AgentStatus, NeedsYouList } from "@/components/agent-panel";
import { AgentChat } from "@/components/agent-chat";
import { AutoRefresh } from "@/components/auto-refresh";
import { DEFAULT_CHAT_MODEL, QUICK_QUESTIONS } from "@/lib/agent/chat";
import { agentFeed, needsYou, nextPayday } from "@/lib/agent/view";
import { guardPage, appDb } from "@/lib/session";
import { readEnv } from "@/lib/env";
import { getBusiness } from "@/lib/store";

export default async function AgentPage() {
  await guardPage();
  await connection();
  const business = await getBusiness((await appDb()));
  if (!business) return <p className="text-muted">Set up your business first.</p>;
  const env = readEnv();
  const [feed, waiting] = await Promise.all([agentFeed((await appDb()), 20), needsYou((await appDb()))]);
  const r = business.rules;
  return (
    <div className="space-y-6">
      <AutoRefresh active everyMs={5000} />
      <div>
        <h1 className="display text-2xl sm:text-3xl">Your agent</h1>
        <p className="mt-1 text-muted">Ask it anything. Payments always need your confirm.</p>
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
