# Kickoff — the one prompt for Claude Code

1. Put this folder in a new **private** git repo.
2. `cd bursar && claude`
3. Paste the prompt below. Claude Code stops at each milestone checkpoint and waits for your OK.

```text
You are building Bursr for NEAR HACKATHON (submissions close 14 Nov 2026, 23:59 UTC).

1. Read, in this order: AGENTS.md, CLAUDE.md, docs/PRD.md, docs/TASKS.md, docs/DECISIONS.md, docs/NEAR-NOTES.md and everything in docs/hackathon/. Then read https://nearhackathon.com/HACKATHON.md in full. AGENTS.md is your rulebook; follow it exactly, especially the "never without my OK" list.

2. In one short message tell me: the product in 3 sentences, how the owner's rules are enforced without trusting the AI, and anything in the PRD you think is wrong, risky or unclear. Don't wait for my reply unless something is a blocker; otherwise continue.

3. Install the NEAR agent skills (npx skills add near/agent-skills) and load them before writing NEAR, Intents or NEAR AI code.

4. Build milestone by milestone from docs/TASKS.md, starting at M0, in order:
   - Show a brief plan for each milestone, then build it.
   - Answer every open question in docs/DECISIONS.md from the official docs and the Agent API SDK repo. Quote the line you relied on. Never guess endpoints, asset IDs, field names, contract IDs or SDK methods. The Agent API vs fallback vault decision is made in M0 and recorded.
   - Dry-run and testnet only. Never touch mainnet, spend funds, push, make anything public or commit secrets without asking me.
   - Every check and every rule gets a test, including the negative case. Keep the README's numbered "do X → see Y" steps true after every change; AI judges will run them.
   - At the end of each milestone run /ship-check, then stop and report: what works, what doesn't, test results, and what I need to do (accounts, keys, funds). Wait for my OK.

5. P0 only until the dry-run demo in PRD §9 works from a fresh clone. Follow the 10 Nov rule in docs/TASKS.md.

Start now with step 1.
```
