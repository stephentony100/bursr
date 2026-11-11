# Bursr — Product Requirements Document

Built for NEAR HACKATHON (1–14 Nov 2026).
Main track: **Autonomous Business** (`business`). Also entered in **Real-World Money** (`realworld`), **Privacy & Private AI** (`privacy`) and **AI Security & Defense** (`security`).


---

## 1. One line

Bursr is an AI that pays a small business's bills: it reads supplier invoices, catches mistakes and fraud, proposes one payment plan a week that the owner approves with one tap, then pays everyone in stablecoins on whatever chain they use — privately and never above the owner's limits.

## 2. The problem (ground level)

A small business in Lagos — a restaurant, a pharmacy, a design studio — pays suppliers, staff and software bills every week. Today the owner:

- reads invoices that arrive by WhatsApp, email and paper;
- checks each one against what was agreed, often after the money is gone;
- gets caught by duplicate invoices, wrong amounts, and fake "our bank details changed" messages (a common fraud);
- pays each person one by one, in whatever way they accept;
- has no clean record at the end of the month.

Businesses that already hold stablecoins have the same problem, plus suppliers who each want payment on a different chain.

*(Before the demo, add one or two real, checked numbers about invoice fraud or late payments. Never invent figures.)*

## 3. Users

| User | What they do |
| --- | --- |
| **Owner** (primary) | Sets the rules once, adds approved payees, forwards invoices, approves the weekly plan, reads statements |
| **Bursr agent** | Reads invoices, checks them, builds the plan, pays within the rules, writes the records |
| **Payee** (supplier, staff) | Receives stablecoins on their chosen chain and token; never needs to use Bursr |
| **Accountant** | Opens the monthly export |

## 4. What NEAR pieces do (and why each is needed)

| Need | NEAR piece | Role |
| --- | --- | --- |
| The agent holds money but cannot break the owner's rules | **NEAR Intents Agent API** (policy-bound agent account, owner signs a spending policy once) — fallback: our own `bursar-vault` contract + function-call key | Rules are enforced outside the AI, so a confused or tricked agent still cannot overspend or pay unknown addresses |
| Pay anyone on any chain in any token | **NEAR Intents / 1Click API** | One balance of USDC on NEAR pays a supplier in USDT on Tron, staff in USDC on Base, etc. |
| Payments private by default | **Confidential settlement** (1Click swaps settle on the NEAR Private Shard since 27 Oct 2026) | Salaries and supplier prices are not public |
| Reading invoices and judging them privately | **NEAR AI Cloud** (TEE inference, verifiable attestation) | Invoice contents and the business's finances are processed privately; the app shows proof |

## 5. Core flows

### 5.1 Setup (owner, once)

1. Owner signs in with a NEAR account (wallet selector) and creates the Bursr agent account.
2. Owner sets the rules in plain fields:
   - weekly spending cap and per-payment cap (USD);
   - approval threshold (any single payment above this needs its own approval);
   - which tokens the agent may spend;
   - payday schedule (e.g. every Friday).
3. Owner signs the policy. Bursr records it in the agent account (Agent API policy, or vault contract settings).
4. Owner funds the agent account with USDC on NEAR (live mode) or uses demo funds (dry-run).

### 5.2 Payees

- Owner adds approved payees: name, category (supplier / staff / software), payout chain + token + address, optional agreed price list (e.g. "Crate of tomatoes: ₦X / $Y").
- Changing a payee's payout address requires the owner, never the agent, and triggers a 48-hour hold flag on that payee (the classic "bank details changed" fraud).
- Staff can be set as recurring (amount + schedule).

### 5.3 Invoices in

- Upload (PDF, image, or pasted text) in the web app. P1: forward by email; P1: send to the Telegram bot.
- The **Reader** step (NEAR AI Cloud, structured output validated with zod) extracts: supplier name, invoice number, date, due date, line items, total, currency, payout details if present.
- If a field is unclear, the invoice goes to "needs owner" with the reason; Bursr never guesses an amount.

### 5.4 Checks (every invoice)

Hard rules first, then AI judgement, each with a plain-English reason:

| Check | Result if it fails |
| --- | --- |
| Supplier matches an approved payee | Hold: "Unknown supplier" |
| Look-alike name (e.g. "Dangote Cernent" vs "Dangote Cement") | Block: "Name looks like X but is not X" |
| Payout details differ from the payee record | Block: "Payout details changed — confirm with the supplier by phone" |
| Duplicate (same supplier + invoice number, or same amount within 14 days) | Hold: "Possible duplicate of invoice #…" |
| Line prices above the agreed price list by more than the tolerance | Hold: "Tomatoes billed at $Z, agreed $Y" |
| Total does not equal the sum of lines | Hold: "Arithmetic error" |
| Would exceed the weekly cap | Defer to next week, with reason |
| AI judgement: anything unusual in wording or urgency ("pay today or account closed") | Flag with the AI's reason; never auto-block on AI alone |

### 5.5 The weekly plan

1. On payday (or on demand) Bursr builds a plan: payments ready to go, payments held (with reasons), recurring staff pay, total vs weekly cap, cost of any swaps (from 1Click dry quotes).
2. The owner approves the whole plan with one tap — in the web app (always available) or in Telegram (P1).
3. Items above the approval threshold or to payees added in the last 7 days need their own tap.
4. The owner can remove any item before approving.

### 5.6 Paying

- For each approved item, Bursr pays from the agent account:
  - payee on NEAR with USDC → direct transfer;
  - any other chain/token → 1Click quote (`EXACT_OUTPUT`, payee receives exactly the invoice amount) and deposit from the agent account.
- The agent account's own rules (Agent API policy or vault) are the final gate: if a payment breaks them, it fails, and Bursr records why.
- Status for every payment: pending → sent → delivered / refunded / failed, with links where available.
- **Kill switch:** one button freezes the agent account; no payments until the owner unfreezes.

### 5.7 Records

- A statement line for every payment: date, payee, what it was for (from the invoice), amount sent, amount received, chain/token, reason it was approved, plan ID.
- Monthly summary in plain English (NEAR AI Cloud), plus CSV export.
- Because settlement is confidential, the statement is the owner's main proof of what happened; each line keeps the quote ID, deposit address and status from 1Click.

## 6. Requirements

**P0** = must ship. **P1** = should ship. **P2** = only if time remains.

| ID | Requirement | P |
| --- | --- | --- |
| B1 | Owner sign-in; agent account created; rules form; owner signs policy (Agent API, or vault fallback — decided in M0) | P0 |
| B2 | Payee list with payout chain/token/address, agreed prices, recurring staff pay; owner-only payout changes with hold flag | P0 |
| B3 | Invoice upload (PDF/image/text) → Reader extraction via NEAR AI Cloud with zod validation; "needs owner" path | P0 |
| B4 | All checks in §5.4 with reasons; unit tests for each, including negative cases | P0 |
| B5 | Weekly plan builder with dry 1Click quotes and cap maths | P0 |
| B6 | Web approvals: approve whole plan, per-item approvals above threshold, remove items | P0 |
| B7 | Execution via agent account: same-chain transfer and cross-chain via 1Click; status tracking; failures explained | P0 |
| B8 | Kill switch | P0 |
| B9 | Statement + CSV export | P0 |
| B10 | Dry-run mode (default): sample business, sample invoices (including one fake look-alike, one duplicate, one changed-bank-details, one overpriced), real dry quotes, simulated payments; no keys needed | P0 |
| B11 | Telegram bot: plan summary with Approve / Review buttons; alerts for holds and blocks | P1 |
| B12 | NEAR AI Cloud "Verified" panel: attestation fetched with a fresh nonce and checked per docs | P1 |
| B13 | Monthly plain-English summary | P1 |
| B14 | Small Bursr fee per payment via 1Click `appFees`, shown openly | P1 |
| B15 | Invoices by email forwarding | P2 |
| B16 | Staff payslip page per payment | P2 |

## 7. Architecture

```
bursar/
  apps/web/                Next.js (App Router), TypeScript strict, Tailwind
    app/                   /, /setup, /payees, /invoices, /plan, /statement, /demo, /api/*
    lib/agent-account.ts   ONE interface: createAccount, setPolicy, transfer, payCrossChain, freeze, status
                           implementations: agentApi.ts (Agent API) | vault.ts (fallback contract)
    lib/oneclick.ts        quotes (dry + live), deposit, status
    lib/reader.ts          invoice extraction (NEAR AI Cloud), zod schema
    lib/checks/            one file per check + index; pure functions
    lib/plan.ts            plan builder
    lib/telegram.ts        bot (P1)
  contracts/bursar-vault/  fallback only: caps, payee allowlist, plan approvals, freeze (Rust, near-sdk)
  prisma/                  SQLite by default
  fixtures/                sample business, payees, invoices (PDF/images), expected check results
  docs/
```

**The agent-account interface is the key design choice:** all payment code calls `lib/agent-account.ts`, so the app works on the Agent API if access is available, or on the fallback vault if not, without rewriting features.

**Trust model (state in README):**
- The owner's rules are enforced by the agent account (Agent API policy or vault contract), not by the AI.
- The AI reads and judges; it never holds a full-access key.
- Payout address changes need the owner.
- Bursr's server runs the checks; NEAR AI Cloud runs the AI parts in TEEs with verifiable attestation.

## 8. Edge cases

| Case | Behaviour |
| --- | --- |
| 1Click quote minimums (in Sept 2026, swaps under $1,000 were temporarily blocked on nine chains; under $100 on Tron) | Check per chain in M0; plan shows "this payee's chain needs ≥ $X" and suggests USDC on NEAR or another chain |
| Quote expires before payment | Re-quote; never reuse a deposit address |
| Swap refunded or failed | Money returns to the agent account; item goes back to the plan with reason |
| Payee not registered for USDC storage on NEAR | Pay the storage deposit first (small NEAR cost) |
| Owner approves, then the cap changes | Re-check every item against current rules at payment time |
| Reader misreads an amount | Hard rules (sum of lines, price list) catch most; anything uncertain goes to "needs owner" |
| Same invoice uploaded twice | Duplicate check blocks the second |
| Agent tries to pay outside rules (bug or trick) | Agent account rejects; logged as a security event |
| Agent API access not available or demo keys rotate | Fallback vault (decided in M0); README says which is used |

## 9. Demo (2 minutes; also the README "try it" path)

1. A restaurant owner's week: 6 invoices arrive (uploaded in the demo).
2. Bursr reads them and flags 4 problems in plain words: a look-alike supplier name, a duplicate, "our bank details changed", tomatoes billed 30% above the agreed price.
3. The weekly plan: 2 supplier payments + 3 staff salaries ready, 4 held with reasons, total under the weekly cap.
4. Owner taps **Approve plan** (web; Telegram if built).
5. Payments go out: USDC on NEAR to one supplier, USDT on another chain to another, salaries to staff — private by default. Live run on mainnet with tiny amounts, recorded separately; dry-run in the README.
6. A forced attempt to pay above the cap is rejected by the agent account itself.
7. Statement and CSV.

## 10. Judging map

| Judge / criterion | What they see |
| --- | --- |
| Illia | Agent in front, Intents behind, private payments, NEAR's own Agent API used for what it was built for |
| Haseeb | Stablecoin payments for real businesses; agent moves money only inside hard limits; human approves the plan, not every click |
| Mert | Private payroll and supplier payments — privacy with a clear benefit |
| Avichal, Eddy | An app on stablecoin rails with accountability, not infrastructure |
| Kain | Feels like a normal business app; a fee per payment as revenue |
| Technical | Checks with tests, rules enforced outside the AI, real cross-chain payments |
| Ahead of NEAR | NEAR Business (20 Oct) is a team treasury with no AI and spending policies "in development"; Bursr is the AI-run version on NEAR's own agent accounts |

## 11. Out of scope

Naira bank payouts; card payments; lending; taxes beyond the export; multi-user teams; mobile app (web is mobile-friendly).

## 12. Success criteria

- From a fresh clone, a judge completes the dry-run demo by following the README in under 5 minutes, with no keys.
- At least one recorded live payment run on mainnet with tiny amounts, including one cross-chain payment.
- All P0 done; tests pass; no secrets in git history.
