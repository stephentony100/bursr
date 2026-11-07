# Bursar

> Working name. Built at NEAR HACKATHON (1–14 Nov 2026). Tracks: Autonomous Business, Real-World Money, Privacy & Private AI, AI Security & Defense.
> Sister project by the same builder: **Wetin** (link added before submission). The two are independent codebases with no shared code.

## What it is

An AI that pays a small business's bills. It reads supplier invoices, checks them for mistakes and fraud, proposes one payment plan a week that the owner approves with one tap, then pays each payee in stablecoins on the chain they use. The owner's spending rules are enforced by the agent's account on NEAR Intents, not by the AI.

## The problem

<!-- Two or three sentences with real, checked numbers (to add before submission). -->

## Status

Milestones M0–M3 are done: owner rules and payees, the agent account, invoices and checks, the weekly plan, payments and the statement. The whole demo below runs in practice mode. Next (M4): the Telegram bot, the NEAR AI "Verified" panel, and a live run on mainnet with tiny amounts (`docs/TASKS.md`).

## Try it (practice mode: no keys, no funds)

Requirements: Node.js 24 or newer (needed by the Agent API SDK), npm 11 or newer.

1. `git clone <this repo> && cd bursar && npm install`
2. `cp .env.example .env` (optional: every value has a safe practice-mode default)
3. `npm test` → all tests pass, including one allowed and one refused case for every account rule (`apps/web/lib/agent-account/evaluate.test.ts`).
4. `npm run demo` → loads the sample restaurant, "Bukka Corner Restaurant": 6 payees (3 suppliers, 3 staff) paid in USDC on NEAR, USDT on Tron, USDC on Base and USDC on Solana, and this week's 6 invoices (`fixtures/invoices/*.png`), each read and checked. It prints:
   ```
   invoice  Mama Put Farms Ltd #MPF-0412       READY
   invoice  Ikeja Gas & Charcoal #IGC-2291     READY
   invoice  Ek0 Fresh Foods #EFF-7781          BLOCK  look-alike
   invoice  Mama Put Farms Ltd #MPF-0412       HOLD   duplicate (warning: payout-changed)
   invoice  Eko Fresh Foods #EFF-7790          BLOCK  payout-changed (warning: urgency)
   invoice  Mama Put Farms Ltd #MPF-0419       HOLD   overpriced (warning: payout-changed)
   ```
   The readings are real NEAR AI Cloud readings of these images, recorded on 7 Nov 2026 (`fixtures/invoices/readings/`). Two "payout-changed" warnings are the model misreading one character of a 64-character address: an address that is not even valid as read is only a warning, because Bursar never pays an address taken from an invoice. All names are made up and all addresses are derived from a hash, so nobody holds a key for them.
5. `npm run dev`, open http://localhost:3000 → **This week** shows "$2,500.00" left to spend this week, payments "Allowed", and $6000 of demo USDC to pay from.
6. Open **Invoices** → "6 invoices · 2 ready · 4 need attention", each with its reason in plain words, for example "Name looks like Eko Fresh Foods but is not Eko Fresh Foods ("Ek0 Fresh Foods"). Possible fraud: do not pay.", "Possible duplicate of invoice #MPF-0412 …", "Payout details changed: the invoice asks for payment to …" and "Tomatoes (crate) billed at $23.40, agreed $18.00 (30% more).". **see the invoice** opens the original image; **What Bursar read** shows the lines and who read them ("NEAR AI Cloud, Qwen/Qwen3-VL-30B-A3B-Instruct (recorded 2026-11-07)").
7. Open **Plan** → **Prepare this week's plan** → "$658.00" and "5 payments · costs about … USDC with network fees": the 3 staff's weekly pay (Bisi $220 in USDC on Base, Tunde $110 in USDT on Tron, Amaka $120 in USDC on Solana) and the 2 clean invoices (Mama Put Farms $118 in USDC on NEAR, Ikeja Gas $90 in USDC on Base). Each shows its network fee and time from a real **dry** 1Click quote (Tron is the dearest, about $1.6). **Not in this plan** lists the 4 problem invoices with their reasons. (Offline, the plan still builds and shows "no price quote".)
8. Click **Approve plan and pay** → "Plan approved. 5 payments sent." Each payment shows "Sent, on its way…" and then "Delivered" within about 30 seconds (the page refreshes itself). In practice mode the payments go to the simulated account; nothing leaves your machine.
9. On the same page click **Try to force a payment above your limit** → "Refused by the account. This payment is above the owner's per-payment cap of $900.00." The request went straight to the account, skipping the plan and the approval.
10. Open **Statement** → 5 lines totalling $658.00, each with the payee's chain and address, who approved it and when, and the account's references. **Download CSV** saves the same as a spreadsheet file.
11. Back on **This week** → "$1,842.00" left to spend this week; "What happened" lists the approval, each payment and the refused attempt.
12. Open **Rules & account** → **Test the rules** (asks the account, pays nothing):
   - "A normal payment" → "Allowed. The account would allow this payment."
   - "Over the single-payment limit" → "Refused by the account. This payment is above the owner's per-payment cap of $900.00."
   - "To someone not on the list" → "Refused by the account. This address is not on the owner's list of payees. Only the owner can add it."
13. On the same page click **Freeze all payments**, then **Test the rules** → "A normal payment" → "Refused by the account. The account is frozen…". Click **Unfreeze payments** to undo.
14. Open **Payees** → **Eko Fresh Foods** → under "Where they are paid" replace the address with `TVKyuVBG5PYyZf8NoQPzN55doSmovLuAVR` (another made-up Tron address) → **Change payout details** → "Payout details changed. Payments to Eko Fresh Foods are on hold for 48 hours." Back on **Payees** they show "On hold until …", and **This week** → "What happened" logs the change. Typing a malformed address instead gives "That doesn't look like a valid address for this network".
15. `npm run smoke:oneclick` → two real **dry** 1Click quotes from USDC held in a NEAR Intents balance: one paying exactly 50 USDT on Tron, one paying exactly 50 USDC on Base. `dry: true` creates no deposit address; nothing is spent.
16. `npm run smoke:nearai` → confirms the invoice-reading model (`Qwen/Qwen3-VL-30B-A3B-Instruct`) accepts images. With `NEAR_AI_API_KEY` set and credits on the account it also reads `fixtures/invoices/smoke-invoice.svg`.
17. `npm run smoke:agent-api` → shows the Agent API's network (`mainnet`, contract `outlayer.near`); with `AGENT_API_KEY` set, also the key's quota.

In practice mode the agent account is a local simulator of the Agent API policy (`apps/web/lib/agent-account/evaluate.ts`): same rules, same refusal codes, demo money. The six sample invoices are recognised by their file hash and their readings come from `fixtures/invoices/readings/`, recorded from NEAR AI Cloud with `npm run readings:record` (if those files are deleted, the hand-typed values in `apps/web/lib/sample-invoices.ts` are used and the page says so). Reading any other invoice needs `NEAR_AI_API_KEY`. The checks themselves (`apps/web/lib/checks/`) are the same code in both modes. Plan prices come from real 1Click dry quotes (`dry: true`: no deposit address, nothing can be spent); payments are simulated with the same idempotency keys a live payment uses. Nothing leaves your machine except those quote requests.

To start again from scratch: `npm run demo`.

## Live mode (real account on NEAR mainnet; the owner's choice)

Live mode uses a real NEAR Intents Agent API account. There is no testnet for it. Steps for the owner:

1. In `.env`: `BURSAR_MODE=live`, `DATABASE_URL=file:./live.db` (run `npm run db:push` after each update), `NEAR_AI_API_KEY` (with credits, to read invoices), `AGENT_API_KEY=naa_…` (from https://partners.demo.agentsonintents.com/dashboard), and a long random `BURSAR_SESSION_SECRET`. Then `npm run db:push` and `npm run dev`.
2. **Rules & account** → **Sign in with NEAR wallet** (HOT Wallet and others via `@hot-labs/near-connect`). The server checks the signed message and that the key is a full-access key of the account.
3. Set up the business (starts at $20 a week, $10 a payment), add payees, then **Create the agent account with these rules**. The page shows the exact policy first; your wallet signs it (a gasless delegate action the Agent API relays).
4. **Let Bursar pay inside these rules** → your wallet signs a grant; put the shown `AGENT_API_GRANT_TOKEN` line in `.env` and restart.
5. `npm run rules:live` → asks the live account for payments the rules forbid (an unlisted address; one unit over the per-payment cap) and saves its answers in `fixtures/live/`. Run it on an unfunded account: refused requests create no operation and move nothing.

## Live run

**6 Nov 2026: the rules are enforced by the live account.** Owner `stephentony.near` (HOT Wallet) created agent account `b51a22df90ed4516f318d926d383484489bba21f6c61dcdac80e376f58c9906a` on NEAR mainnet through the Agent API. Its policy was applied on-chain in transaction [`CYwUmJKvrCTyptM26Fp7SG2P3fa1QqZtVYGTDjwtD93C`](https://nearblocks.io/txns/CYwUmJKvrCTyptM26Fp7SG2P3fa1QqZtVYGTDjwtD93C): $20 a week, $10 a payment, USDC on NEAR only, one payee (`stephentony.near`). The account holds no funds. `npm run rules:live` then asked it for payments the rules forbid:

| Request | The account answered |
| --- | --- |
| Preview: $1 to an address not on the list | warning `policy_destination_denied` |
| Real request: $1 to an address not on the list | **403 `policy_destination_denied`** (layer `policy`); no operation created |
| Preview: $10.000001 to the listed payee (cap $10) | warning `policy_transaction_limit_exceeded` |

Full responses: `fixtures/live/rules-live-2026-11-06.json`. Bursar's code did not decide any of these; the Agent API did.

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
- The invoice reader (an AI model) can misread long strings: in our recorded run it dropped one character of a 64-character address on 3 of 6 invoices and was unsure of one supplier name. Bursar treats an invalid address as a misreading (warning) and anything the model is unsure of as "needs you"; it never pays an address read from an invoice.
- PDFs are not read yet; send a photo or screenshot.

## Built with

Next.js, React, Tailwind CSS, TypeScript, Prisma (SQLite via better-sqlite3), zod, Vitest, tsx, the OpenAI SDK (pointed at NEAR AI Cloud), `@near-intents-agent-api/sdk`, near-api-js (NEP-413 sign-in check), `@hot-labs/near-connect` (wallet sign-in and signing), sharp. Fonts: Bricolage Grotesque, Public Sans, IBM Plex Mono (Google Fonts via `next/font`). Scaffolded with `create-next-app`. Written with Claude Code (Anthropic); NEAR agent skills from `near/agent-skills`.

## License

MIT
