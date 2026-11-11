# Bursr

> Built at NEAR HACKATHON (1–14 Nov 2026). Tracks: Autonomous Business, Real-World Money, Privacy & Private AI, AI Security & Defense.

## What it is

An AI agent that pays a small business's staff and suppliers in stablecoins. The owner sets the limits once; the agent then works on its own: it reads supplier invoices and checks them for mistakes and fraud, pays each person on their own schedule (weekly, every two weeks, monthly, or when an invoice is due) in the stablecoin and on the chain they chose, retries what fails, and asks the owner only about exceptions (someone it has never paid, an amount above the owner's threshold, a suspicious invoice). The owner can watch every step it takes and talk to it. The limits are enforced by the agent's account on NEAR Intents, not by the AI.

## The problem

Fake payment instructions are one of the costliest frauds a business faces. Business email compromise, a scam that targets "businesses … working with suppliers and/or … regularly performing wire transfer payments", cost victims $3.05 billion in 2025, second only to investment fraud ([FBI IC3 Internet Crime Report 2025](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)), and 74% of US organizations were hit by it that year ([AFP Payments Fraud and Control Survey 2026](https://www.financialprofessionals.org/about/learn-more/press-releases/Details/over-75-percent-of-us-firms-experienced-payments-fraud-in-2025-while-ai-adoption-for-fraud-mitigation-lags)). Small firms suffer most: organizations with fewer than 100 employees have the highest median loss to occupational fraud, USD 126,000, and billing schemes (fake or inflated invoices) are among the frauds that hit them far more often than larger firms ([ACFE Report to the Nations 2026](https://www.acfe.com/-/media/files/acfe/pdfs/rttn/2026/2026-report-to-the-nations.pdf)). In Nigeria, Lagos accounts for 63% of digital payment fraud activity ([NIBSS, 2025 data](https://nibss-plc.com.ng/nibss-digital-payment-fraud-drops-51-to-%E2%82%A625-85b-in-2025/)). Bursr is for the owner who pays suppliers and staff every week and cannot afford one wrong payment.

## Status

Done: owner rules and payees, the agent account (live on NEAR mainnet, with real payments, see "Live run"), invoice reading and checks, the agent (autopilot, payment schedules, self-repair, live activity feed, chat, Telegram), adding money (one tap from a NEAR wallet, or a deposit address with QR from other chains), records and the CSV export, the NEAR AI "Verified" panel, the monthly plain-English summary and Bursr's fee (0.5% per payment run, on the owner's signed list). The whole demo below runs in practice mode. Not done: card or bank top-up (researched, see Limitations).

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
   The readings are real NEAR AI Cloud readings of these images, recorded on 7 Nov 2026 (`fixtures/invoices/readings/`). Two "payout-changed" warnings are the model misreading one character of a 64-character address: an address that is not even valid as read is only a warning, because Bursr never pays an address taken from an invoice. All names are made up and all addresses are derived from a hash, so nobody holds a key for them.
5. `npm run dev`, open http://localhost:3000 → the Bursr home page: "Pay your chef. Never the wrong person." (the word after "Pay your" changes every few seconds) and a phone running payday: each row turns from "Paying…" to "Paid", that person's "received" card appears beside the phone on their own network (USDC on Base, USDT on Tron, …), and a look-alike supplier ("Blocked: Ek0 Fresh Foods") is stopped. Below: the networks people can be paid on, a statement that lights up word by word as you scroll, and photos of the people a business pays, each with a Bursr moment. Scrolling then walks through a week in four pinned steps ("Invoices come in.", "Every one is checked.", "One list. One OK.", "Everyone is paid."), then the four checks open one by one (Look-alike names, The same bill twice, Changed bank details, Prices creeping up), and **Your limits** cycles through the weekly limit, the $900.00 per-payment limit (a $5,000 payment request is refused), the payee list and the emergency stop. Click **Try it with a sample restaurant** (or open http://localhost:3000/this-week) → **Home**: the **Wallet balance** card (with a hide/show eye, the weekly limit bar and **Add money**, **Pay someone**, **Ask agent**) and its status "Agent working". You don't press anything: within a few seconds of `npm run dev` starting, the agent finds this week's payments due and pays them (the page refreshes every 5 seconds). **Your agent** shows its latest step, and **Recent payments** fills in with one row per payment (for example "Bisi Adeyemi (head chef) · Weekly pay · Base · $220.00 · Paid"). The bar then shows about $1,837 left this week (the $661.29 paid plus the network fees the business paid on top). On the right, **Next payday** shows "6 of 6" paid this week and "4 invoices need a look"; **Coming up** lists next Friday's pay. On a phone the menu moves to tabs along the bottom (Home, Payments, Invoices, People, More).
6. Open **Invoices** → "6 invoices · 2 ready · 4 need attention", each with its reason in plain words, for example "Name looks like Eko Fresh Foods but is not Eko Fresh Foods ("Ek0 Fresh Foods"). Possible fraud: do not pay.", "Possible duplicate of invoice #MPF-0412 …", "Payment details changed: this invoice asks you to pay …" and "Tomatoes (crate) billed at $23.40, agreed $18.00 (30% more).". **view invoice** opens the original image; **What Bursr read from it** shows the lines and who read them ("NEAR AI Cloud, Qwen/Qwen3-VL-30B-A3B-Instruct (recorded 2026-11-07)"). At the top, **Your invoices stay private → Check the proof** (needs internet, no key) sends a fresh random nonce to NEAR AI Cloud and verifies the signed hardware report for the gateway and the reading model, following NEAR AI's verification steps. It shows "Proof checked" and four plain lines, each with a tick; **Technical details for your accountant or auditor** lists every check (Intel TDX quote genuine and up to date, not in debug mode, quote bound to the signing key and our nonce, configuration measurement, event-log replay, NVIDIA GPU attestation), each with a tick or a cross.
7. Open **Payments** → "Your agent paid these on its own on …", $661.29: the 3 staff's weekly pay (Bisi $220 in USDC on Base, Tunde $110 in USDT on Tron, Amaka $120 in USDC on Solana), the 2 clean invoices (Mama Put Farms $118 in USDC on NEAR, Ikeja Gas $90 in USDC on Base), and "Bursr fee (0.5% of $658.00)" = $3.29, Bursr's own revenue, each "Paid". The fee address is on the owner's signed list like anyone else, so the AI cannot raise it or send it elsewhere. Each line shows "+ about $X network fee, paid by you" and the arrival time from a real **dry** 1Click quote (Tron is the dearest, about $1.6): the business pays the network fee on top, so each person receives the full amount. In practice mode the payments go to the simulated wallet; nothing leaves your machine.
8. Open **Agent** → a chat with your agent next to its full activity: "6 payments are due ($661.29). Paying now: …", then for each payment "Started paying …", "Sent …" (for example "Sent Bisi Adeyemi (head chef) $220.00 (Weekly pay) in USDC on Base.") and "… received …". In live mode it also shows the steps in between ("Exchanging … into USDC on Base for …", "Sending … to …'s wallet on Base…"). Without a NEAR AI key it answers the questions under the box from Bursr's own data: **What did you pay this week?** lists the 6 payments, each "delivered"; **How much is left this week?** → "You have $1,83… left of your $2,500.00 weekly limit, …" (the cents depend on that day's network fees); **Which invoices are on hold, and why?** lists the 4 problem invoices and their reasons. **Run payday now** answers with a card you confirm (**Run it**) before the agent pays anything due by the coming payday. With `NEAR_AI_API_KEY` set, you can type freely: "Pay Bisi a $20 bonus for covering Sunday" → a card "Pay Bisi Adeyemi (head chef) $20.00" → **Yes, pay it** → the feed shows "Sent Bisi Adeyemi (head chef) $20.00 (bonus for covering Sunday) in USDC on Base." The agent only proposes; nothing moves until you confirm, and it refuses to make up an amount ("Pay Tunde a bonus too" → it asks how much). The chat model, `Qwen/Qwen3.6-35B-A3B-FP8` on NEAR AI Cloud, runs in a TEE whose proof the app can check like the invoice reader's.
9. Back on **Payments**, click **Try to sneak a big payment past your limits** → "Blocked by your spending rules. This is more than your $900.00 limit for a single payment." (with a shield icon). The request went straight to the wallet, skipping the list and the approval.
10. Open **Records** → "In November 2026 Bursr paid $661.29 in 6 payments: $450.00 to staff and $208.00 to suppliers, and $3.29 in Bursr fees. …" (Bursr's own summary, computed from its records; with `NEAR_AI_API_KEY`, **Write it as a friendly note** rewrites it and rejects the result if it mentions any figure that is not in the records). Below it, 6 lines totalling $661.29, each with where the money went, when it was approved, and the wallet's proof references. **Download CSV** saves the same as a spreadsheet file, with a "Network fee (paid by you)" column.
11. Open **Agent** → the activity lists each payment and the blocked attempt ("Your spending rules blocked a payment: This is more than your $900.00 limit for a single payment.").
12. Open **Limits** (under Money; on a phone, **More**) → **See your limits in action** (asks the wallet, pays nothing):
   - "A normal payment" → "Allowed. This would go through, just as it should." (with a green tick)
   - "One that's too big" → "Blocked by your spending rules. This is more than your $900.00 limit for a single payment."
   - "To a stranger" → "Blocked by your spending rules. This wallet isn't one of the people you pay. Only you can add someone new."
13. On the same page, under **Emergency stop**, click **Pause all payments**, then "A normal payment" → "Blocked by your spending rules. Payments are paused. …". Click **Turn payments back on** to undo.
14. Open **People** → **Eko Fresh Foods** → under "Where they get paid" replace the address with `TVKyuVBG5PYyZf8NoQPzN55doSmovLuAVR` (another made-up Tron address) → **Change where they get paid** → "Saved. For your safety, payments to Eko Fresh Foods are on hold for 48 hours." Back on **People** they show "On hold to …", and **Agent** logs the change. Typing a malformed address instead gives "That doesn't look like a valid address for this network".
15. Open **Wallet** (or **Add money** on Home) → "In your Bursr wallet" and what the coming payday needs. **Add practice money** → "Added $500 of practice money…", and within a minute the feed says "Your Bursr wallet received $500.00. …". In live mode this page tops up from your own wallet instead (see Live mode). **Move money back to my wallet** sends money back to the signed-in owner's own account and nowhere else: type an amount and **Move it back**, or **Move all I can**; anything above the largest single payment goes in parts, the weekly limit still applies, and the feed says "Moved $… back to your wallet (…)".
16. Set up a business of your own, the way a new owner would (this clears the sample; `npm run demo` brings it back): on the home page click **Set up your business** (or go to http://localhost:3000/welcome) → **Start my own business** → a guided setup with a step list on the left:
   - **Your business**: name, time zone (taken from your browser), payday → **Save and continue**.
   - **Your limits**: pick **Small team** ($500 a week · $200 a payment) or type your own, Autopilot, when to pay invoices, and which networks people may ask to be paid on.
   - **Who you pay**: type a name and a regular pay (for example 80), **Make their invite link** → a link with **Copy link** and **Send on WhatsApp**. Open the link in another browser (it is what your staff member sees, no sign-in) → "Hi …, how do you want to be paid?" → pick USDT on Tron, paste `TVKyuVBG5PYyZf8NoQPzN55doSmovLuAVR` → **Send my details** → "Thanks, … Your details were sent to …". Back in the setup the person shows "Sent their details: check and approve" → **Approve** → they join your list (their first payment still asks for your OK). **I have their wallet address** adds someone directly instead. Later, **People** → **Add people** has four tabs: **Add someone**, **Send a link** (**A whole group (one link for everyone)** makes one link for a group chat; each person types their name, and **Approve all** adds everyone who answered), **Pay once**, and **Add many** (a spreadsheet saved as CSV: **Download the template**, then **Check the file** → each row "ready" or what to fix → **Add N people**).
   - **Turn on your agent** (in live mode your wallet confirms twice, see Live mode) → **Add money** (**Add $500 of practice money**) → **All set**: "Your agent is on." with the first payments it will make → **Go to my dashboard**.
17. `npm run smoke:oneclick` → two real **dry** 1Click quotes from USDC held in a NEAR Intents balance: one paying exactly 50 USDT on Tron, one paying exactly 50 USDC on Base. `dry: true` creates no deposit address; nothing is spent.
18. `npm run smoke:nearai` → confirms the invoice-reading model (`Qwen/Qwen3-VL-30B-A3B-Instruct`) accepts images. With `NEAR_AI_API_KEY` set and credits on the account it also reads `fixtures/invoices/smoke-invoice.svg`.
19. `npm run smoke:agent-api` → shows the Agent API's network (`mainnet`, contract `outlayer.near`); with `AGENT_API_KEY` set, also the key's quota.
20. `npm run verify:ai` → the same TEE verification in the terminal; ends with "VERIFIED: every check passed." (needs internet, no key).

In practice mode the agent account is a local simulator of the Agent API policy (`apps/web/lib/agent-account/evaluate.ts`): same rules, same refusal codes, demo money. The six sample invoices are recognised by their file hash and their readings come from `fixtures/invoices/readings/`, recorded from NEAR AI Cloud with `npm run readings:record` (if those files are deleted, the hand-typed values in `apps/web/lib/sample-invoices.ts` are used and the page says so). Reading any other invoice needs `NEAR_AI_API_KEY`. The checks themselves (`apps/web/lib/checks/`) are the same code in both modes. Plan prices come from real 1Click dry quotes (`dry: true`: no deposit address, nothing can be spent); payments are simulated with the same idempotency keys a live payment uses. Nothing leaves your machine except those quote requests (and chat messages, if you set a NEAR AI key). The agent runs inside the app (`apps/web/instrumentation.ts` → `lib/agent/loop.ts`): it wakes every minute, and every few seconds while payments are on their way; `BURSAR_AGENT=off` stops it.

To start again from scratch: `npm run demo`.

## Live mode (real account on NEAR mainnet; the owner's choice)

Live mode uses a real NEAR Intents Agent API account. There is no testnet for it. Steps for the owner:

1. In `.env`: `BURSAR_MODE=live`, `DATABASE_URL=file:./live.db` (run `npm run db:push` after each update), `NEAR_AI_API_KEY` (with credits, to read invoices), `AGENT_API_KEY` (from https://partners.demo.agentsonintents.com/dashboard), a long random `BURSAR_SESSION_SECRET` and `BURSAR_DATA_KEY` (64 hex characters; `.env.example` shows how to make one). Then `npm run db:push` and `npm run dev`.
2. Open http://localhost:3000 → **Get started** (new) or **Sign in** (returning). Both just ask for your wallet: a wallet that already has a business goes straight to it, a new one goes to setup (`/welcome`). The setup walks through:
   - **Connect your wallet**: HOT Wallet and others via `@hot-labs/near-connect`; the server checks the signed message and that the key is a full-access key of the account.
   - **Your business**, **Your limits** (start small; autopilot; invoice timing; networks) and **Who you pay**: invite links let staff and suppliers enter how they want to be paid; nothing is payable until you approve what they sent.
3. **Turn on your agent**: your wallet confirms twice, both free. "Confirmation 1 of 2" creates the agent's own wallet with your limits and people in its policy (the exact policy is under "Technical details of what you're confirming"; a gasless delegate action the Agent API relays). "Confirmation 2 of 2" lets the agent pay inside them: a 30-day grant whose token Bursr keeps in the database, encrypted with `BURSAR_DATA_KEY` (AES-256-GCM, bound to the agent); nothing to copy, no restart. Three days before it ends, the Limits page offers to renew it.
4. **Add money** (or later), then **All set** → the dashboard. One Bursr serves many businesses: each wallet that signs in sees only the business it set up, on any device; a wallet that has none is taken to setup. (Terminal scripts such as `npm run fund` work on the only business, or on the one whose owner is named with `BURSAR_OWNER=<account>`.) Adding or approving someone later changes the payee list: a bar at the top then asks your wallet to confirm the new list before they can be paid.
5. `npm run rules:live` → asks the live account for payments the rules forbid (an unlisted address; one unit over the per-payment cap) and saves its answers in `fixtures/live/`. Run it on an unfunded account: refused requests create no operation and move nothing.
6. **Add money**: one tap from your connected NEAR wallet if it holds USDC (your wallet confirms one `ft_transfer_call` of USDC to `intents.near` for the agent's account; you need about 0.01 NEAR for gas), or pick another network (USDC on Base, Solana, Sui, Ethereum, Arbitrum, USDT on Tron…) → **Get my deposit address** → an address and QR code for this deposit only; what arrives is changed into USDC on NEAR. The agent says in the feed when the money has arrived, and warns up to three days before payday if the wallet holds less than payday needs. (`npm run fund -- <TOKEN> <chain>` prints the same kind of address in the terminal.) To take money out, **Move money back to my wallet** on the same page: the agent withdraws USDC to your own NEAR account (it must already hold USDC once, or the page says so). The Agent API has no owner withdrawal, so this is the agent's withdraw inside your signed rules; your own account is always on the list you sign. Never delete the agent with money in it: deletion does not sweep balances back.
7. From then on the agent pays each person on their day. The first payment to someone new, and anything above "Ask me first above", waits under **Needs you** (and in Telegram) for your **OK, pay it**. Problems are retried by the agent: not enough money (paid as soon as it arrives), weekly limit used up (paid when it refills), network trouble (retried with the same idempotency key, so nothing is paid twice), a NEAR account that can't hold the token yet (checked again daily). Each payment is followed to its final status and the payee-side transaction is recorded on the statement.

## Telegram (optional)

Needs your own bot token (message @BotFather → `/newbot`), so it is not part of the steps above.

1. Put the token in `.env` as `TELEGRAM_BOT_TOKEN`, run `npm run db:push` once, then `npm run bot` in a second terminal → "Bursr bot @… running".
2. **Limits** → **Telegram** → **Connect my Telegram** → "Open @… in Telegram and send: /link ABCD1234". Send that to the bot → "You're connected. …".
3. Type to the bot as you would in the web chat ("What did you pay this week?", "Pay Bisi a $20 bonus"): it is the same agent, and its action cards come as buttons. `/plan` shows the current list.
4. The agent's news arrives within about 20 seconds: what it is paying, payments that need your OK (with an **✅ OK, pay it** button), money it needs before payday, money that arrived, stopped or held invoices, payments that could not be sent, and payments your spending rules blocked. Each is sent once.

Only the chat linked with a one-time code from the owner's signed-in web session can approve; any other chat gets "This chat isn't connected." Five wrong codes cancel the pending code. Tested on 7 Nov 2026 with @bursrbot: linking, `/plan`, the four sample alerts, and approving and paying the practice plan from Telegram.

## Live run

**6 Nov 2026: the rules are enforced by the live account.** Owner `stephentony.near` (HOT Wallet) created agent account `b51a22df90ed4516f318d926d383484489bba21f6c61dcdac80e376f58c9906a` on NEAR mainnet through the Agent API. Its policy was applied on-chain in transaction [`CYwUmJKvrCTyptM26Fp7SG2P3fa1QqZtVYGTDjwtD93C`](https://nearblocks.io/txns/CYwUmJKvrCTyptM26Fp7SG2P3fa1QqZtVYGTDjwtD93C): $20 a week, $10 a payment, USDC on NEAR only, one payee (`stephentony.near`). The account holds no funds. `npm run rules:live` then asked it for payments the rules forbid:

| Request | The account answered |
| --- | --- |
| Preview: $1 to an address not on the list | warning `policy_destination_denied` |
| Real request: $1 to an address not on the list | **403 `policy_destination_denied`** (layer `policy`); no operation created |
| Preview: $10.000001 to the listed payee (cap $10) | warning `policy_transaction_limit_exceeded` |

Full responses: `fixtures/live/rules-live-2026-11-06.json`. Bursr's code did not decide any of these; the Agent API did.

**7 Nov 2026: live payment preview, no money moved.** With a second payee on Base (`0x4128…2600`) signed into the rules (revision 3), `npm run live:preview` asked the live account to preview this week's plan ($1 to each address). The account raised no rule warnings, only `insufficient_balance` (it holds $0), and quoted the fees: about $0.005 per withdrawal, so each payee would receive about $0.995. No money moved that day.

**9 Nov 2026: first real payments, from a new business onboarded in the app.** A fresh database and a new agent account (`a26944b9e2c9caa8133f6249d66255cc46ab1f21d9c76a9c9b5ad9f8b9f4595a`), with limits of $1 a week and $0.50 a payment. The owner funded it with 1.00 USDC sent from a Sui wallet to a one-time deposit address (credited 0.999798 USDC on NEAR). The agent then paid:

| To | Sent | Received | Payee-side transaction |
| --- | --- | --- | --- |
| USDC on Base | 0.25 (swap USDC NEAR → Base, then withdraw) | 0.2476 | [`0x3013d684…07c59df`](https://basescan.org/tx/0x3013d6843780a431f1d8c7c19cc1d08efbf1b4247f53a8433e666a30e07c59df) |
| USDC on Sui | 0.25 (swap, then withdraw) | 0.23 | [`BdECi8C9…ZDL8`](https://suiscan.xyz/mainnet/tx/BdECi8C9SLc6RfVAfYMZTWDzZ6gG8bPAJf9N5qf1ZDL8) |

The account's own limits stopped things three times during the run, as they should: a $0.9998 internal move above the $0.50 per-payment limit (`policy_transaction_limit_exceeded`), a $999 request (same), and the Sui send while the $1 weekly budget was used up (`spend_budget_exceeded`; it went through after the owner raised the limit). What we learned is in `docs/DECISIONS.md` (9 Nov): the weekly budget counts a swap and its withdrawal separately; a NEAR account must be registered with USDC before it can receive it (Bursr now checks first); confidential payments failed on the provider's side, so live payments use the public balance.

## How NEAR is used

| Step | NEAR piece | What it does here |
| --- | --- | --- |
| Rules the AI cannot break | NEAR Intents **Agent API** policy | Weekly USD budget, per-payment cap, payee allowlist (exact chain + address), allowed tokens, freeze |
| Paying anyone on any chain | NEAR Intents (Agent API `swap` + `withdraw`, priced with 1Click quotes) | USDC held on NEAR Intents pays out in the payee's chosen chain and token |
| Private payments (switched off for now) | Confidential Intents | Built and wired (`PRIVATE_PAYMENTS` in `apps/web/lib/agent-account/agent-api.ts`), but on 9 Nov 2026 the wallet provider refused every confidential swap and withdrawal ("1Click's intent is not the transfer that was quoted"; nothing was signed), so live payments use the agent's public balance until that is fixed upstream |
| Reading and judging invoices | NEAR AI Cloud | Inference in TEEs, with attestation |

Details and the doc lines relied on: `docs/DECISIONS.md`.

## Trust model

- The owner's rules live in the agent's Agent API policy, which only the owner's signature can change. The Agent API service (in an Intel TDX confidential VM) enforces the payee allowlist and the USD budget; its TEE wallet provider enforces the per-payment cap, allowed tokens and freeze. Bursr's code and the AI cannot override either.
- The AI reads and judges invoices. It never holds the owner's key; the agent acts only through a grant token the owner signed.
- Only the owner adds payees or changes payout addresses (that is a policy change signed by the owner).
- In practice mode the same rules are checked by a local simulator of the Agent API policy, and payments are simulated.
- Owner-only code (`lib/owner-actions.ts`) needs an owner session; a test (`lib/boundaries.test.ts`) fails if any agent-side module imports it. Changing a payout address starts a 48-hour hold on that payee.

## Limitations

- NEAR Intents and the Agent API have no testnet. Live payments use mainnet with tiny amounts, only with the owner's approval.
- The Agent API policy cannot stop a second payment to an allowed payee; Bursr's duplicate check covers that.
- The invoice reader (an AI model) can misread long strings: in our recorded run it dropped one character of a 64-character address on 3 of 6 invoices and was unsure of one supplier name. Bursr treats an invalid address as a misreading (warning) and anything the model is unsure of as "needs you"; it never pays an address read from an invoice.
- PDFs are not read yet; send a photo or screenshot.
- The network fee is paid by the business: the agent sends the amount owed plus the withdrawal fee from 1Click's quote (about $0.005 on Base, $0.02 on Sui). The Agent API has no exact-output withdrawal and its fee preview is empty for public withdrawals to other chains, so this is an estimate; the statement records what actually arrived and the fee paid, and a payment that arrives short says so.
- The agent's wallet holds at most 256 payout addresses (Agent API limit), so a business can add up to 256 different addresses (people sharing one count once). Payments go out one at a time (one money action per wallet), within the wallet's 1,000 operations a day.
- The live account's weekly budget counts a payment in another token or on another chain twice (the swap, then the withdrawal). Bursr's plan counts it twice too, so it never promises more than the limit allows.
- A NEAR account must have held a token once before it can receive it (NEP-145 storage). Bursr checks before paying and tells the owner; it cannot register the account for the payee.
- Private (confidential) payments are switched off until NEAR Intents fixes a provider-side error (see "How NEAR is used").
- Card or bank top-up is not built. Research (9 Nov): Transak supports USDC on NEAR, locking the destination address, naira bank transfer in Nigeria, and self-serve staging keys; it is the planned way for owners without a crypto wallet.
- One business per wallet for now: a wallet that owns two businesses would need a second wallet or a business switcher (planned).
- The "Verified" panel checks the attestation report before use; it does not yet verify the per-response signature of each invoice reading (`/v1/signature/<chat_id>`).

## Built with

Next.js, React, Tailwind CSS, TypeScript, Prisma (SQLite via better-sqlite3), zod, Vitest, tsx, the OpenAI SDK (pointed at NEAR AI Cloud), `@near-intents-agent-api/sdk`, near-api-js (NEP-413 sign-in check), `@hot-labs/near-connect` (wallet sign-in and signing), `@phala/dcap-qvl` (Intel TDX quote verification), grammY (Telegram bot), sharp, qrcode (deposit QR codes, MIT). Animation: GSAP 3.15 with ScrollTrigger, SplitText and CustomEase, and `@gsap/react` (GSAP Standard no-charge license). Icons: Phosphor (`@phosphor-icons/react`). Fonts: Plus Jakarta Sans and Inter (SIL Open Font License, Google Fonts via `next/font`). Scaffolded with `create-next-app`. Written with Claude Code (Anthropic); NEAR agent skills from `near/agent-skills`. For the home page design, two public sites (myrefactory.com and showcase.8am.com) were captured locally with Deja-View (github.com/Nuel-osas/Deja-View, Playwright) and used only as visual reference; no code or assets from them are in this repo. The current UI follows the frontend-ui-engineering skill (addyosmani/agent-skills) for Claude Code. Home page patterns were studied in Deja-View captures and rebuilt with GSAP using the same settings: the pinned split-screen steps and blur text reveal from hear.ai, the pinned services accordion from newengen.com, and the auto-advancing feature tabs from Stax.ai (griflan-stax.netlify.app); none of their code or assets are in this repo.

Smooth scrolling on the home page: Lenis (MIT, darkroom.engineering), set up with `lerp: 0.1` and driven by GSAP's ticker, as on the reference sites we studied.

Photos on the home page (free licences, `apps/web/public/photos/`):
- Restaurant owner, Abuja: Dennis Ojenomoh, [Pexels](https://www.pexels.com/photo/african-28074289/) (Pexels License)
- Street cook, Lagos: Jboy Designer, [Pexels](https://www.pexels.com/photo/street-vendor-cooking-traditional-jollof-rice-34772940/) (Pexels License)
- Shopkeeper, Abuja: Muhammad-Taha Ibrahim, [Pexels](https://www.pexels.com/photo/nigerian-shopkeeper-in-local-grocery-store-30020992/) (Pexels License)
- Tomato and pepper seller, Bodija Market, Ibadan: Tunde Buremo, [Unsplash](https://unsplash.com/photos/a-group-of-people-standing-around-a-table-filled-with-tomatoes-cnVn4Gg4b00) (Unsplash License)
- Fruit seller with her phone: Ali Mkumbwa, [Unsplash](https://unsplash.com/photos/a-woman-standing-in-front-of-a-fruit-stand-holding-a-cell-phone-5dFuO02OHh0) (Unsplash License)

The phone mockup, cards and icons are drawn in code from the app's own screens; no third-party artwork or logos.

## License

MIT
