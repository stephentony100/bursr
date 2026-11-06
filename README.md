# Bursar

> Working name. Built at NEAR HACKATHON (1–14 Nov 2026). Tracks: Autonomous Business, Real-World Money, Privacy & Private AI, AI Security & Defense.
> Sister project by the same builder: **Wetin** (link added before submission). The two are independent codebases with no shared code.

## What it is

An AI that pays a small business's bills. It reads supplier invoices, checks them for mistakes and fraud, proposes one payment plan a week that the owner approves with one tap, then pays each payee in stablecoins on the chain they use. The owner's spending rules are enforced by the agent's account on NEAR Intents, not by the AI.

## The problem

<!-- Two or three sentences with real, checked numbers (to add before submission). -->

## Status

Milestones M0 (setup) and M1 (owner, rules, payees, agent account) are done. Invoices and checks (M2) and the weekly plan and payments (M3) are next (`docs/TASKS.md`). The steps below are the ones that work today.

## Try it (practice mode: no keys, no funds)

Requirements: Node.js 24 or newer (needed by the Agent API SDK), npm 11 or newer.

1. `git clone <this repo> && cd bursar && npm install`
2. `cp .env.example .env` (optional: every value has a safe practice-mode default)
3. `npm test` → all tests pass, including one allowed and one refused case for every account rule (`apps/web/lib/agent-account/evaluate.test.ts`).
4. `npm run demo` → loads the sample restaurant, "Bukka Corner Restaurant", and prints its 6 payees (3 suppliers, 3 staff) paid in USDC on NEAR, USDT on Tron, USDC on Base and USDC on Solana. All names are made up and all addresses are derived from a hash, so nobody holds a key for them.
5. `npm run dev`, open http://localhost:3000 → **This week** shows "$2,500.00" left to spend this week, payments "Allowed", and $6000 of demo USDC to pay from.
6. Open **Rules & account** → **Test the rules**:
   - "A normal payment" → "Allowed. The account would allow this payment."
   - "Over the single-payment limit" → "Refused by the account. This payment is above the owner's per-payment cap of $900.00."
   - "To someone not on the list" → "Refused by the account. This address is not on the owner's list of payees. Only the owner can add it."
7. On the same page click **Freeze all payments**, then **Test the rules** → "A normal payment" → "Refused by the account. The account is frozen…". Click **Unfreeze payments** to undo.
8. Open **Payees** → **Eko Fresh Foods** → under "Where they are paid" replace the address with `TVKyuVBG5PYyZf8NoQPzN55doSmovLuAVR` (another made-up Tron address) → **Change payout details** → "Payout details changed. Payments to Eko Fresh Foods are on hold for 48 hours." Back on **Payees** they show "On hold until …", and **This week** → "What happened" logs the change. Typing a malformed address instead gives "That doesn't look like a valid address for this network".
9. `npm run smoke:oneclick` → two real **dry** 1Click quotes from USDC held in a NEAR Intents balance: one paying exactly 50 USDT on Tron, one paying exactly 50 USDC on Base. `dry: true` creates no deposit address; nothing is spent.
10. `npm run smoke:nearai` → confirms the invoice-reading model (`Qwen/Qwen3-VL-30B-A3B-Instruct`) accepts images. With `NEAR_AI_API_KEY` set and credits on the account it also reads `fixtures/invoices/smoke-invoice.svg`.
11. `npm run smoke:agent-api` → shows the Agent API's network (`mainnet`, contract `outlayer.near`); with `AGENT_API_KEY` set, also the key's quota.

In practice mode the agent account is a local simulator of the Agent API policy (`apps/web/lib/agent-account/evaluate.ts`): same rules, same refusal codes, demo money. Nothing leaves your machine except the dry quotes.

## Live mode (real account on NEAR mainnet; the owner's choice)

Live mode uses a real NEAR Intents Agent API account. There is no testnet for it. Steps for the owner:

1. In `.env`: `BURSAR_MODE=live`, `DATABASE_URL=file:./live.db`, `AGENT_API_KEY=naa_…` (from https://partners.demo.agentsonintents.com/dashboard), and a long random `BURSAR_SESSION_SECRET`. Then `npm run db:push` and `npm run dev`.
2. **Rules & account** → **Sign in with NEAR wallet** (HOT Wallet and others via `@hot-labs/near-connect`). The server checks the signed message and that the key is a full-access key of the account.
3. Set up the business (starts at $20 a week, $10 a payment), add payees, then **Create the agent account with these rules**. The page shows the exact policy first; your wallet signs it (a gasless delegate action the Agent API relays).
4. **Let Bursar pay inside these rules** → your wallet signs a grant; put the shown `AGENT_API_GRANT_TOKEN` line in `.env` and restart.
5. `npm run rules:live` → asks the live account for payments the rules forbid (an unlisted address; one unit over the per-payment cap) and saves its answers in `fixtures/live/`. Run it on an unfunded account: refused requests create no operation and move nothing.

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
- In practice mode the same rules are checked by a local simulator of the Agent API policy, and payments are simulated.
- Owner-only code (`lib/owner-actions.ts`) needs an owner session; a test (`lib/boundaries.test.ts`) fails if any agent-side module imports it. Changing a payout address starts a 48-hour hold on that payee.

## Limitations

- NEAR Intents and the Agent API have no testnet. Live payments use mainnet with tiny amounts, only with the owner's approval.
- The Agent API policy cannot stop a second payment to an allowed payee; Bursar's duplicate check covers that.

## Built with

Next.js, React, Tailwind CSS, TypeScript, Prisma (SQLite via better-sqlite3), zod, Vitest, tsx, the OpenAI SDK (pointed at NEAR AI Cloud), `@near-intents-agent-api/sdk`, near-api-js (NEP-413 sign-in check), `@hot-labs/near-connect` (wallet sign-in and signing), sharp. Fonts: Bricolage Grotesque, Public Sans, IBM Plex Mono (Google Fonts via `next/font`). Scaffolded with `create-next-app`. Written with Claude Code (Anthropic); NEAR agent skills from `near/agent-skills`.

## License

MIT
