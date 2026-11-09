# AGENTS.md — rules for coding agents (Claude Code, Codex)

You are building **Bursar** for NEAR HACKATHON (submissions close **14 Nov 2026, 23:59 UTC**). Read this file fully, then `docs/PRD.md`, `docs/TASKS.md`, `docs/DECISIONS.md` and `docs/NEAR-NOTES.md`.

## What we are building

An AI that pays a small business's bills: reads invoices, checks them (look-alikes, duplicates, changed payout details, overpricing), proposes a weekly payment plan the owner approves once, and pays each payee in stablecoins on any chain through NEAR Intents — inside rules enforced by the agent account, not by the AI. Full spec: `docs/PRD.md`.

## Hard rules

1. **Never guess NEAR, Intents, Agent API or NEAR AI details.** Look them up: https://docs.near.org/llms.txt, https://docs.near-intents.org/llms.txt, https://docs.near.ai, the Agent API SDK repo (https://github.com/NEAR-Intents-Agent-API/sdk-typescript). Install and use the NEAR agent skills: `npx skills add near/agent-skills`. `docs/NEAR-NOTES.md` is a starting point, not a source of truth; if the docs differ, the docs win — note it in DECISIONS.md.
2. **Never without the human's explicit OK:** sending the hackathon submission; posting anywhere; making the repo public, pushing or force-pushing; signing transactions on mainnet, spending real tokens or deploying to mainnet; committing secrets. Testnet, demo environments and dry quotes are fine.
3. **The AI never holds a full-access key and never enforces the rules.** Spending limits, payee allowlist and freeze are enforced by the agent account (Agent API policy or the fallback vault contract). All payment code goes through `apps/web/lib/agent-account.ts`.
4. **Only the owner changes payees or payout addresses.** No code path lets the agent do it.
5. **Never invent amounts.** If the Reader is unsure of a field, the invoice goes to "needs owner".
6. **Money is integers in smallest units** (string/bigint). Never floats. Read token decimals from the token list.
7. **Secrets only in `.env`.** Keep `.env.example` complete and secret-free.
8. **The README is read and run by AI judges** (Claude Code and Codex screen every entry: does it run, does it do what the README says). Keep numbered "do X → see Y" steps true after every change. Dry-run path first, needing no keys. No marketing copy.
9. **Work counts from 19 Oct 2026** (HACKATHON.md Q-001). Libraries, templates, boilerplate, open-source code and AI-generated code are allowed (Q-005) and must be listed in README "Built with". We may freely recreate any visual effect, layout or interaction we see elsewhere: study it and build it ourselves, or use the libraries those sites use (e.g. GSAP, Motion, Lottie). We may reuse third-party code only if its license allows it (e.g. MIT, Apache-2.0), keeping its license notice and crediting it in the README. Do not paste a website's own scripts or stylesheets that have no reuse license, because the repo must stay public through judging (Q-014) and unlicensed code risks a takedown.
10. **This repo is independent of Wetin** (the builder's other entry). No shared code or imports.
11. **Scope:** P0 first, in `docs/TASKS.md` order. P1/P2 only after the full dry-run demo (PRD §9) works from a fresh clone.
12. **Record decisions** in `docs/DECISIONS.md` with date, reason and the doc line relied on.

## Stack

- npm workspaces. `apps/web`: Next.js App Router, TypeScript strict, Tailwind, Prisma + SQLite (`file:./dev.db`).
- `near-api-js` (version per docs) + wallet selector for owner sign-in.
- Agent API TypeScript SDK if access is confirmed in M0; otherwise `contracts/bursar-vault` (Rust, near-sdk) with a function-call key for the agent.
- 1Click API for cross-chain payments (dry quotes in dry-run).
- OpenAI SDK pointed at NEAR AI Cloud (`https://cloud-api.near.ai/v1`), model from env; zod for every LLM output and external input.
- grammY for the Telegram bot (P1).
- Vitest for unit tests; contract tests per the near-smart-contracts skill.

## Conventions

- Checks are pure functions `(invoice, payees, history, rules) → {status, reason}` with one file and one test file each.
- Every external call goes through one module in `apps/web/lib/` with typed responses and timeouts.
- Anything retried (payments, status polling, Telegram messages) is idempotent by key.
- UI words are plain English for a shop owner. No jargon on screen.
- Small commits, clear messages. Tag `hackathon-submission` at the end.

## Commands (keep true)

```
npm install
npm run dev                 # http://localhost:3000, dry-run by default
npm test
npm run demo                # loads the sample restaurant and its invoices
npm run vault:build         # only if the fallback vault is used
npm run vault:test
npm run vault:deploy:testnet
npm run bot                 # Telegram bot (P1)
```

## Checkpoints

At the end of each milestone in `docs/TASKS.md`: run `/ship-check`, then stop and report what works, what doesn't, test results, and anything the human must do (accounts, keys, funds). Wait for the human's OK.
