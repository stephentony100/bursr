# Bursar — build plan

Built in parallel with Wetin (separate repo). Deadline **14 Nov 2026, 23:59 UTC** (00:59 on 15 Nov in Lagos).
**10 Nov rule:** if the dry-run demo (PRD §9, steps 1–5 simulated) does not work end to end by 10 Nov, stop adding features and spend the remaining days making P0 solid.

Each milestone ends at a checkpoint: `/ship-check`, report, wait for OK.

## M0 — Setup and access (5–6 Nov)

- [x] Read all docs in this repo and https://nearhackathon.com/HACKATHON.md
- [x] `npx skills add near/agent-skills`
- [x] Scaffold: npm workspaces, Next.js, Tailwind, Prisma + SQLite, Vitest, ESLint
- [x] **Agent API decision:** read the SDK repo and docs; try the demo environment; record whether the policy covers what PRD §5.1 needs (caps, allowed destinations, assets, freeze) and whether cross-chain payments work from the agent account. Decide Agent API vs fallback vault and record it
- [x] 1Click smoke script: one dry quote USDC on NEAR → USDT on another chain; record asset IDs from the tokens endpoint and the current quote minimums per chain
- [x] NEAR AI Cloud smoke script: one structured extraction from a sample invoice image; pick a model that reads images; record it
- [x] README skeleton + LICENSE committed

**Done when:** three smoke scripts run; DECISIONS.md answers every open question.

## M1 — Owner, rules, payees (6–7 Nov)

- [x] Owner sign-in; rules form; create agent account; sign policy (or deploy vault + function-call key on testnet)
- [x] Payees: add/edit, payout details, agreed price list, recurring staff pay; payout change = owner only + 48h hold flag
- [x] Kill switch (freeze/unfreeze)

**Done when:** a testnet/demo agent account exists with the owner's rules, and a payment outside the rules is rejected by the account itself (test).

## M2 — Invoices and checks (7–8 Nov)

- [x] Upload image/text; Reader extraction with zod; "needs owner" path (PDF: not read yet, the owner is asked for a photo; see DECISIONS)
- [x] All checks in PRD §5.4, one file + tests each (positive and negative)
- [x] Fixtures: sample restaurant, 6 invoices including look-alike, duplicate, changed bank details, overpriced

**Done when:** running the fixtures produces exactly the expected holds/blocks with the expected reasons.

## M3 — Plan, approval, payment (8–10 Nov)

- [x] Plan builder with cap maths and dry quotes
- [x] Web approvals: whole plan, per-item above threshold, remove item
- [x] Execution through `agent-account.ts`: same-chain withdraw, cross-chain = swap + withdraw (Agent API, priced with 1Click dry quotes); status tracking (practice mode simulated; live status polling in M4); failures recorded with reasons and come back in the next plan
- [x] Dry-run mode: simulated payments with realistic status progression
- [x] Statement + CSV

**Done when:** the full PRD §9 demo runs in dry-run from a fresh clone. → **10 Nov rule.**

## M4 — P1 (10–12 Nov)

- [ ] Telegram bot: plan summary + Approve / Review; alerts
- [x] NEAR AI Cloud Verified panel
- [x] Monthly summary (Bursar computes the facts; NEAR AI only rephrases; any figure not in the records is rejected)
- [ ] appFees: the Agent API has no app-fee field; see DECISIONS
- [ ] **With the human:** live mainnet run with tiny amounts (one same-chain, one cross-chain payment); save links for README. 7 Nov: payees + rules signed (revision 3), live dry preview clean; paused because the account is not funded (owner chose to defer)

## M5 — Submission (12–14 Nov)

- [ ] README final: problem, how it works, how NEAR is used (concrete), trust model, try-it steps (dry-run first), live-run evidence, limitations, Built with, link to Wetin
- [ ] `/ship-check`; tag `hackathon-submission`
- [ ] Demo video ≤ 2 min + X post draft per `docs/hackathon/SUBMITTING.md` — **human posts**
- [ ] Submission payload (tracks: business, realworld, privacy, security) — **human confirms before sending**
