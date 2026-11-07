# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Owner (primary):** runs a small business (the sample is a Lagos restaurant, Bukka Corner) and pays suppliers and staff every week. Sets spending limits once, adds the people they pay, uploads invoice photos, approves one weekly list, reads the records. Not a developer; uses plain business words.
- **Payees:** suppliers and staff who receive stablecoins on the network and token they chose. They never use Bursar.
- **Accountant:** opens the monthly CSV export.
- **Hackathon judges:** AI agents (Claude Code, Codex) and people who clone the repo, run the README's numbered steps, and check each one is true.

## Product Purpose

Bursar is an AI that pays a small business's bills. It reads supplier invoices, checks each one for fraud and mistakes (look-alike names, duplicates, changed payout details, prices above what was agreed, unclear fields), proposes one weekly list of payments, and pays everyone after a single approval. Success: the owner never pays the wrong person or the wrong amount, and Friday's payments take one tap.

## Positioning

The AI does the work but never holds the rules. Spending limits, the list of people who may be paid, and the emergency stop are enforced by the owner's NEAR Intents agent account (the "Bursar wallet"), so a confused or tricked AI still cannot overspend or pay a stranger. Invoices are read inside NEAR AI Cloud's sealed hardware, with a proof the owner can check. Payments settle privately and reach each payee on their own chain (NEAR, Base, Tron, Solana) through NEAR Intents.

## Operating Context

- Weekly rhythm: invoices arrive Monday to Thursday; payday is Friday.
- Demo (practice) mode runs with no keys: a sample restaurant, six sample invoices (two clean, four with problems), three staff, practice money. Live mode uses a real wallet (HOT Wallet sign-in) and real stablecoins.
- Surfaces: a public landing page at `/`; the app at `/this-week`, `/invoices`, `/payments`, `/records`, `/people`, `/spending-rules`; a Telegram bot for approvals and alerts.

## Capabilities and Constraints

- Invoice upload accepts PNG, JPEG, WebP and text (not PDF).
- Money is integer smallest units; amounts are never invented. Unsure fields send an invoice to the owner.
- Only the owner can add payees or change where they get paid; a payout change starts a 48-hour safety hold.
- Bursar's fee is 0.5% of each week's payouts, shown on the list before approval.
- The README's numbered "do X, see Y" steps must stay true after every UI change.

## Brand Commitments

- Name: Bursar. Voice: plain, warm English for a shop owner; no developer jargon on screen (technical detail sits behind "Technical details" toggles).
- Existing logo: a ledger page with a tick (components/logo.tsx).

## Evidence on Hand

- Sample week data: lib/sample.ts, lib/sample-invoices.ts, fixtures/invoices/*.png (drawn invoice images).
- Sourced fraud figures in README "The problem" (FBI IC3 2025, AFP 2026, ACFE 2026, NIBSS 2025).
- No customers, testimonials, logos or usage numbers exist. Never fabricate them.

## Product Principles

1. Prove, don't claim: show the real checks on real sample invoices.
2. The owner decides; Bursar holds anything odd and says why in one sentence.
3. Limits live in the wallet, not the AI.
4. Every screen readable by a busy owner in seconds.

## Accessibility & Inclusion

WCAG AA contrast; works on a phone; respects reduced motion.
