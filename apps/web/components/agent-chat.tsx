"use client";

import { PaperPlaneRight, Robot, ShieldCheck } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { chatAction, confirmCardAction } from "@/app/actions";
import type { ActionCard, ChatTurn } from "@/lib/agent/chat";

// The chat with Bursar's agent. Answers come from the agent's tools; any
// action comes back as a card the owner confirms.

type Line = ChatTurn & { cards?: ActionCard[] };

export function AgentChat({ businessName, quickQuestions, privateModel }: { businessName: string; quickQuestions: string[]; privateModel: string | null }) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([
    { role: "assistant", content: `Hi, I'm the agent that pays ${businessName}'s people. Ask me what I've paid, what's coming up, or tell me to pay someone.` },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Record<string, string>>({});
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [lines, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Line[] = [...lines, { role: "user", content: q }];
    setLines(next);
    setText("");
    setBusy(true);
    const r = await chatAction(next.map(({ role, content }) => ({ role, content })));
    setLines([...next, { role: "assistant", content: r.reply, cards: r.cards }]);
    setBusy(false);
  }

  async function confirm(token: string) {
    setDone((d) => ({ ...d, [token]: "…" }));
    const r = await confirmCardAction(token);
    setDone((d) => ({ ...d, [token]: r?.message ?? "Done." }));
    router.refresh();
  }

  return (
    <section aria-label="Chat with your agent" className="flex h-[36rem] flex-col overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <Robot size={18} weight="bold" aria-hidden className="text-ledger" /> Ask your agent
        </p>
        {privateModel && (
          <p className="flex items-center gap-1 text-xs text-muted" title={privateModel}>
            <ShieldCheck size={14} weight="bold" aria-hidden className="text-ledger" /> Private: runs in a sealed computer
          </p>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={l.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-xl px-3.5 py-2.5 text-sm ${l.role === "user" ? "bg-ledger text-white" : "bg-paper-2"}`}>{l.content}</div>
            {l.cards?.map((c) => (
              <div key={c.token} className="mt-2 max-w-[85%] rounded-xl border border-ledger/40 bg-ledger-soft/60 p-3.5 text-sm">
                <p className="font-semibold">{c.title}</p>
                <p className="text-muted">{c.detail}</p>
                {done[c.token] ? (
                  <p role="status" className="mt-2 font-medium text-ledger">
                    {done[c.token]}
                  </p>
                ) : (
                  <button onClick={() => confirm(c.token)} className="mt-2 rounded-lg bg-ledger px-3 py-1.5 font-semibold text-white hover:bg-indigo">
                    {c.confirm}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
        {busy && <p className="text-sm text-muted">Thinking…</p>}
        <div ref={end} />
      </div>
      <div className="border-t border-line px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickQuestions.map((q) => (
            <button key={q} onClick={() => ask(q)} disabled={busy} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-ink/40 hover:text-ink disabled:opacity-50">
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor="agent-chat-input">
            Message your agent
          </label>
          <input
            id="agent-chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Pay Bisi a $20 bonus"
            className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="rounded-lg bg-ledger px-3 text-white hover:bg-indigo disabled:opacity-50">
            <PaperPlaneRight size={18} weight="bold" aria-hidden />
          </button>
        </form>
      </div>
    </section>
  );
}
