---
description: Milestone / pre-submission check against hackathon rules and the README
---

Run this checklist and report each item as PASS / FAIL with evidence. Do not fix anything without asking.

1. Secrets: `git status`, `git diff --cached`, and `git log -p | grep -iE "private_key|ed25519:|seed|secret|api_key|bot_token"`. Report any match.
2. Fresh install: `npm install`, `npm test` (and `npm run vault:test` if the vault is used) all pass.
3. Follow every numbered step in README "Try it" exactly as written in dry-run mode. Report any step whose result differs from the README.
4. Rules hold: a test proves a payment above the cap, to a non-approved payee, or while frozen is rejected by the agent account itself (not just by app code).
5. Fixtures: the sample invoices produce exactly the expected holds/blocks and reasons.
6. README has: what it is, the problem, try-it steps, how NEAR is used (concrete), trust model, limitations, Built with, link to Wetin. No placeholders left (`<`, `TODO`).
7. LICENSE exists; `.env.example` lists every variable the code reads (`grep -r "process.env."`).
8. All P0 items in docs/TASKS.md for finished milestones are ticked.
9. Remind the human of the never-without-OK list before anything public, mainnet or submission-related.
