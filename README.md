# Bursar

> Working name. Built at NEAR HACKATHON (1–14 Nov 2026). Tracks: Autonomous Business, Real-World Money, Privacy & Private AI, AI Security & Defense.
> Sister project by the same builder: **Wetin** (link added before submission). The two are independent codebases with no shared code.

## What it is

An AI that pays a small business's bills. It reads supplier invoices, checks them for mistakes and fraud, proposes one payment plan a week that the owner approves with one tap, then pays each payee in stablecoins on the chain they use. The owner's spending rules are enforced by the agent's account on NEAR Intents, not by the AI.

## The problem

Fake payment instructions are one of the costliest frauds a business faces. Business email compromise, a scam that targets "businesses … working with suppliers and/or … regularly performing wire transfer payments", cost victims $3.05 billion in 2025, second only to investment fraud ([FBI IC3 Internet Crime Report 2025](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)), and 74% of US organizations were hit by it that year ([AFP Payments Fraud and Control Survey 2026](https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags)). Small firms suffer most: organizations with fewer than 100 employees have the highest median loss to occupational fraud, USD 126,000, and billing schemes (fake or inflated invoices) are among the frauds that hit them far more often than larger firms ([ACFE Report to the Nations 2026](https://www.acfe.com/-/media/files/acfe/pdfs/rttn/2026/2026-report-to-the-nations.pdf)). In Nigeria, Lagos accounts for 63% of digital payment fraud activity ([NIBSS, 2025 data](https://nibss-plc.com.ng/nibss-digital-payment-fraud-drops-51-to-%E2%82%A625-85b-in-2025/)). Bursar is for the owner who pays suppliers and staff every week and cannot afford one wrong payment.

## Status

Milestones M0–M3 are done: owner rules and payees, the agent account, invoices and checks, the weekly plan, payments and the statement. M4 so far: the NEAR AI "Verified" panel, the live payment path and the monthly summary. The whole demo below runs in practice mode. Also done: the monthly plain-English summary, Bursar's fee (0.5% per plan, on the owner's signed list) and the Telegram bot. Not done yet: a paid live run on mainnet (`docs/TASKS.md`).

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
5. `npm run dev`, open http://localhost:3000 → the Bursar home page ("Pay everyone. Never the wrong person."). Scrolling plays the sample week: six invoices drop in, a scanner stamps each one Ready, Blocked or Hold, the four problem invoices fall into "Held for you", and six payments ($661.29) fly to NEAR, Base, Tron and Solana. Click **Try it with a sample restaurant** (or open http://localhost:3000/this-week) → **This week** shows "$2,500.00" left to spend this week, payments "On", "$6,000.00" in the Bursar wallet (practice money), and a shortcut "4 invoices need a look. See why →". The screens use plain words for a shop owner; technical details sit behind "Technical details" toggles.
6. Open **Invoices** → "6 invoices · 2 ready · 4 need attention", each with its reason in plain words, for example "Name looks like Eko Fresh Foods but is not Eko Fresh Foods ("Ek0 Fresh Foods"). Possible fraud: do not pay.", "Possible duplicate of invoice #MPF-0412 …", "Payment details changed: this invoice asks you to pay …" and "Tomatoes (crate) billed at $23.40, agreed $18.00 (30% more).". **view invoice** opens the original image; **What Bursar read from it** shows the lines and who read them ("NEAR AI Cloud, Qwen/Qwen3-VL-30B-A3B-Instruct (recorded 2026-11-07)"). At the top, **Your invoices stay private → Check the proof** (needs internet, no key) sends a fresh random nonce to NEAR AI Cloud and verifies the signed hardware report for the gateway and the reading model, following NEAR AI's verification steps. It shows "✓ Proof checked" and four plain lines; **Technical details for your accountant or auditor** lists every check (Intel TDX quote genuine and up to date, not in debug mode, quote bound to the signing key and our nonce, configuration measurement, event-log replay, NVIDIA GPU attestation) with ✓ or ✗.
7. Open **Payments** → **Get this week's payments ready** → "$661.29": the 3 staff's weekly pay (Bisi $220 in USDC on Base, Tunde $110 in USDT on Tron, Amaka $120 in USDC on Solana), the 2 clean invoices (Mama Put Farms $118 in USDC on NEAR, Ikeja Gas $90 in USDC on Base), and "Bursar fee (0.5% of $658.00)" = $3.29, Bursar's own revenue. The fee address is on the owner's signed list like anyone else, so the AI cannot raise it or send it elsewhere; it has no **Not this week** button because it is part of the spending rules. Each line shows its transfer fee and arrival time from a real **dry** 1Click quote (Tron is the dearest, about $1.6). **Not paid this week, and why** lists the 4 problem invoices with their reasons. (Offline, the list still builds and says "fee worked out when paid".)
8. Click **Approve and pay everyone** → "Done. 6 payments on the way." Each payment shows "Sent, on its way…" and then "Paid ✓" within about 30 seconds (the page refreshes itself). In practice mode the payments go to the simulated wallet; nothing leaves your machine.
9. On the same page click **Try to sneak a big payment past your limits** → "🛡 Blocked by your spending rules. This is more than your $900.00 limit for a single payment." The request went straight to the wallet, skipping the list and the approval.
10. Open **Records** → "In November 2026 Bursar paid $661.29 in 6 payments: $450.00 to staff and $208.00 to suppliers, and $3.29 in Bursar fees. …" (Bursar's own summary, computed from its records; with `NEAR_AI_API_KEY`, **Write it as a friendly note** rewrites it and rejects the result if it mentions any figure that is not in the records). Below it, 6 lines totalling $661.29, each with where the money went, when it was approved, and the wallet's proof references. **Download for my accountant (CSV)** saves the same as a spreadsheet file.
11. Back on **This week** → "$1,838.71" left to spend this week; **Latest activity** lists the approval, each payment ("Paid Bisi Adeyemi (head chef): Weekly pay", …) and the blocked attempt.
12. Open **Spending rules** → **See your limits in action** (asks the wallet, pays nothing):
   - "A normal payment" → "✓ Allowed. This would go through, just as it should."
   - "One that's too big" → "🛡 Blocked by your spending rules. This is more than your $900.00 limit for a single payment."
   - "To a stranger" → "🛡 Blocked by your spending rules. This wallet isn't one of the people you pay. Only you can add someone new."
13. On the same page, under **Emergency stop**, click **Pause all payments**, then "A normal payment" → "🛡 Blocked by your spending rules. Payments are paused. …". Click **Turn payments back on** to undo.
14. Open **People** → **Eko Fresh Foods** → under "Where they get paid" replace the address with `TVKyuVBG5PYyZf8NoQPzN55doSmovLuAVR` (another made-up Tron address) → **Change where they get paid** → "Saved. For your safety, payments to Eko Fresh Foods are on hold for 48 hours." Back on **People** they show "Safety hold until …", and **This week** → **Latest activity** logs the change. Typing a malformed address instead gives "That doesn't look like a valid address for this network".
15. `npm run smoke:oneclick` → two real **dry** 1Click quotes from USDC held in a NEAR Intents balance: one paying exactly 50 USDT on Tron, one paying exactly 50 USDC on Base. `dry: true` creates no deposit address; nothing is spent.
16. `npm run smoke:nearai` → confirms the invoice-reading model (`Qwen/Qwen3-VL-30B-A3B-Instruct`) accepts images. With `NEAR_AI_API_KEY` set and credits on the account it also reads `fixtures/invoices/smoke-invoice.svg`.
17. `npm run smoke:agent-api` → shows the Agent API's network (`mainnet`, contract `outlayer.near`); with `AGENT_API_KEY` set, also the key's quota.
18. `npm run verify:ai` → the same TEE verification in the terminal; ends with "VERIFIED: every check passed." (needs internet, no key).

In practice mode the agent account is a local simulator of the Agent API policy (`apps/web/lib/agent-account/evaluate.ts`): same rules, same refusal codes, demo money. The six sample invoices are recognised by their file hash and their readings come from `fixtures/invoices/readings/`, recorded from NEAR AI Cloud with `npm run readings:record` (if those files are deleted, the hand-typed values in `apps/web/lib/sample-invoices.ts` are used and the page says so). Reading any other invoice needs `NEAR_AI_API_KEY`. The checks themselves (`apps/web/lib/checks/`) are the same code in both modes. Plan prices come from real 1Click dry quotes (`dry: true`: no deposit address, nothing can be spent); payments are simulated with the same idempotency keys a live payment uses. Nothing leaves your machine except those quote requests.

To start again from scratch: `npm run demo`.

## Live mode (real account on NEAR mainnet; the owner's choice)

Live mode uses a real NEAR Intents Agent API account. There is no testnet for it. Steps for the owner:

1. In `.env`: `BURSAR_MODE=live`, `DATABASE_URL=file:./live.db` (run `npm run db:push` after each update), `NEAR_AI_API_KEY` (with credits, to read invoices), `AGENT_API_KEY=naa_…` (from https://partners.demo.agentsonintents.com/dashboard), and a long random `BURSAR_SESSION_SECRET`. Then `npm run db:push` and `npm run dev`.
2. **Sign in** (top right; HOT Wallet and others via `@hot-labs/near-connect`). The server checks the signed message and that the key is a full-access key of the account.
3. On **Spending rules**, set up the business (starts at $20 a week, $10 a payment), add people on **People**, then **Set up my Bursar wallet with these limits…**. The exact policy is under "Technical details of what you're confirming"; your wallet signs it (a gasless delegate action the Agent API relays).
4. **Let Bursar make payments inside my limits…** → your wallet signs a grant; put the shown `AGENT_API_GRANT_TOKEN` line in `.env` and restart.
5. `npm run rules:live` → asks the live account for payments the rules forbid (an unlisted address; one unit over the per-payment cap) and saves its answers in `fixtures/live/`. Run it on an unfunded account: refused requests create no operation and move nothing.
6. To pay for real: give people a regular pay (or add invoices), **Payments → Get this week's payments ready**, then `npm run live:preview` (the account's own dry preview of every payment). Fund the account with `npm run fund -- <TOKEN> <chain>` (for example `npm run fund -- USDC near`), which prints a one-time deposit address and the minimum; send from your own wallet. Then **Approve and pay everyone**. Each payment is followed to its final status and the payee-side transaction is recorded on the statement.

## Telegram (optional)

Needs your own bot token (message @BotFather → `/newbot`), so it is not part of the steps above.

1. Put the token in `.env` as `TELEGRAM_BOT_TOKEN`, run `npm run db:push` once, then `npm run bot` in a second terminal → "Bursar bot @… running".
2. **Spending rules** → **Telegram** → **Connect my Telegram** → "Open @… in Telegram and send: /link ABCD1234". Send that to the bot → "You're connected. …".
3. In Telegram send `/plan` → this week's payments, with what is not paid and why, and an **✅ Approve and pay everyone** button. Payments that need their own OK must get it in the web app first; the button then says so.
4. Alerts arrive within about 20 seconds for stopped or held invoices, payments that could not be sent, and payments your spending rules blocked. Each is sent once.

Only the chat linked with a one-time code from the owner's signed-in web session can approve; any other chat gets "This chat isn't connected." Five wrong codes cancel the pending code. Tested on 7 Nov 2026 with @bursrbot: linking, `/plan`, the four sample alerts, and approving and paying the practice plan from Telegram.

## Live run

**6 Nov 2026: the rules are enforced by the live account.** Owner `stephentony.near` (HOT Wallet) created agent account `b51a22df90ed4516f318d926d383484489bba21f6c61dcdac80e376f58c9906a` on NEAR mainnet through the Agent API. Its policy was applied on-chain in transaction [`CYwUmJKvrCTyptM26Fp7SG2P3fa1QqZtVYGTDjwtD93C`](https://nearblocks.io/txns/CYwUmJKvrCTyptM26Fp7SG2P3fa1QqZtVYGTDjwtD93C): $20 a week, $10 a payment, USDC on NEAR only, one payee (`stephentony.near`). The account holds no funds. `npm run rules:live` then asked it for payments the rules forbid:

| Request | The account answered |
| --- | --- |
| Preview: $1 to an address not on the list | warning `policy_destination_denied` |
| Real request: $1 to an address not on the list | **403 `policy_destination_denied`** (layer `policy`); no operation created |
| Preview: $10.000001 to the listed payee (cap $10) | warning `policy_transaction_limit_exceeded` |

Full responses: `fixtures/live/rules-live-2026-11-06.json`. Bursar's code did not decide any of these; the Agent API did.

**7 Nov 2026: live payment preview, no money moved.** With a second payee on Base (`0x4128…2600`) signed into the rules (revision 3), `npm run live:preview` asked the live account to preview this week's plan ($1 to each address). The account raised no rule warnings, only `insufficient_balance` (it holds $0), and quoted the fees: about $0.005 per withdrawal, so each payee would receive about $0.995. **A paid live run has not been done**: the agent account has not been funded. The code path is in place (`lib/pay.ts`: confidential swap, wait for settlement, withdraw, then the account's own status and destination transaction are recorded on the statement); funding steps are under "Live mode" above (`npm run fund -- USDC near`).

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
- No paid live payment has been made yet (see "Live run"). Live payments deduct the network withdrawal fee from the amount sent (about $0.005 on NEAR and Base), so a payee receives slightly less than the invoice; the statement records the exact amount received.
- The "Verified" panel checks the attestation report before use; it does not yet verify the per-response signature of each invoice reading (`/v1/signature/<chat_id>`).

## Built with

Next.js, React, Tailwind CSS, TypeScript, Prisma (SQLite via better-sqlite3), zod, Vitest, tsx, the OpenAI SDK (pointed at NEAR AI Cloud), `@near-intents-agent-api/sdk`, near-api-js (NEP-413 sign-in check), `@hot-labs/near-connect` (wallet sign-in and signing), `@phala/dcap-qvl` (Intel TDX quote verification), grammY (Telegram bot), sharp. Fonts: Bricolage Grotesque, Public Sans, IBM Plex Mono (Google Fonts via `next/font`). Scaffolded with `create-next-app`. Written with Claude Code (Anthropic); NEAR agent skills from `near/agent-skills`. For the home page design, two public sites (myrefactory.com and showcase.8am.com) were captured locally with Deja-View (github.com/Nuel-osas/Deja-View, Playwright) and used only as visual reference; no code or assets from them are in this repo.

## License

MIT
