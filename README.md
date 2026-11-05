# Bursar

> Working name. Built at NEAR HACKATHON (1–14 Nov 2026). Tracks: Autonomous Business, Real-World Money, Privacy & Private AI, AI Security & Defense.
> Sister project by the same builder: **Wetin** (link added before submission). The two are independent codebases with no shared code.

## What it is

An AI that pays a small business's bills. It reads supplier invoices, checks them for mistakes and fraud, proposes one payment plan a week that the owner approves with one tap, then pays each payee in stablecoins on the chain they use. The owner's spending rules are enforced by the agent's account on NEAR Intents, not by the AI.

## The problem

<!-- Two or three sentences with real, checked numbers (to add before submission). -->

## Status

Milestone M0 (setup and access) is done: the project scaffold and three smoke scripts that talk to the real services. The web app, the sample restaurant and the weekly plan arrive in milestones M1–M3 (`docs/TASKS.md`). The steps below are the ones that work today.

## Try it (no keys, no funds)

Requirements: Node.js 24 or newer (needed by the Agent API SDK), npm 11 or newer.

1. `git clone <this repo> && cd bursar && npm install`
2. `cp .env.example .env` (optional: every value has a safe dry-run default)
3. `npm test` → all tests pass.
4. `npm run smoke:oneclick` → two real **dry** 1Click quotes from USDC held in a NEAR Intents balance: one paying exactly 50 USDT on Tron, one paying exactly 50 USDC on Base. Each shows what the agent would pay, the withdrawal fee and the time estimate. `dry: true` creates no deposit address; nothing is spent.
5. `npm run smoke:nearai` → lists NEAR AI Cloud models and confirms the invoice-reading model (`Qwen/Qwen3-VL-30B-A3B-Instruct`) accepts images. With `NEAR_AI_API_KEY` set it also reads the sample invoice in `fixtures/invoices/smoke-invoice.svg` and prints the extracted fields, validated with zod.
6. `npm run smoke:agent-api` → shows the Agent API's network (`mainnet`, contract `outlayer.near`). With `AGENT_API_KEY` set it also checks the key and quota; with an agent id and grant token it previews a withdrawal to an address that is not on the owner's list and prints the account's refusal warning.

## How NEAR is used

| Step | NEAR piece | What it does here |
| --- | --- | --- |
| Rules the AI cannot break | NEAR Intents **Agent API** policy | Weekly USD budget, per-payment cap, payee allowlist (exact chain + address), allowed tokens, freeze |
| Paying anyone on any chain | NEAR Intents (Agent API `swap` + `withdraw`, priced with 1Click quotes) | USDC held on NEAR Intents pays out in the payee's chosen chain and token |
| Private payments | Confidential Intents | Swaps settle on NEAR's private shard; deposits and withdrawals cannot be linked to each other |
| Reading and judging invoices | NEAR AI Cloud | Inference in TEEs, with attestation |

Details and the doc lines relied on: `docs/DECISIONS.md`.

## Trust model

- The owner's rules live in the agent's Agent API policy, which only the owner's signature can change. The Agent API service (in an Intel TDX confidential VM) enforces the payee allowlist and the USD budget; its TEE wallet provider enforces the per-payment cap, allowed tokens and freeze. Bursar's code and the AI cannot override either.
- The AI reads and judges invoices. It never holds the owner's key; the agent acts only through a grant token the owner signed.
- Only the owner adds payees or changes payout addresses (that is a policy change signed by the owner).
- In dry-run mode the same rules are checked by a local simulator of the Agent API policy, and payments are simulated.

## Limitations

- NEAR Intents and the Agent API have no testnet. Live payments use mainnet with tiny amounts, only with the owner's approval.
- The Agent API policy cannot stop a second payment to an allowed payee; Bursar's duplicate check covers that.

## Built with

Next.js, React, Tailwind CSS, TypeScript, Prisma (SQLite), zod, Vitest, tsx, the OpenAI SDK (pointed at NEAR AI Cloud), `@near-intents-agent-api/sdk`, sharp. Scaffolded with `create-next-app`. Written with Claude Code (Anthropic); NEAR agent skills from `near/agent-skills`.

## License

MIT
