# NEAR notes (researched 3–5 Nov 2026)

A starting point gathered from public docs and news. **Verify every item against the official docs before relying on it**, and record what you confirmed in `docs/DECISIONS.md`.

## Where to look things up

- NEAR docs index: https://docs.near.org/llms.txt (also a docs MCP endpoint at `docs.near.org/mcp`)
- NEAR Intents docs index: https://docs.near-intents.org/llms.txt
- Intents changelog: https://docs.near-intents.org/changelog/overview.md
- NEAR AI Cloud: https://docs.near.ai/cloud/ ; verification: https://docs.near.ai/cloud/verification
- Agent API (Intents agent accounts) TypeScript SDK: https://github.com/NEAR-Intents-Agent-API/sdk-typescript
- Agent skills for coding agents: `npx skills add near/agent-skills` (near-ai-cloud, near-api-js, near-dapp, near-intents, near-kit, near-smart-contracts)

## 1Click API (cross-chain swaps and payments)

- Quote: `POST https://1click.chaindefuser.com/v0/quote`. Auth header `X-API-Key` (optional).
- Key fields: `dry` (true = price only, no deposit address), `swapType` (`EXACT_INPUT`, `EXACT_OUTPUT`, `FLEX_INPUT`), `slippageTolerance` (basis points), `originAsset`, `destinationAsset`, `amount` (smallest units, string), `depositType`, `refundTo`, `refundType`, `recipient`, `recipientType`, `deadline`, optional `appFees` (`[{recipient, fee}]`, fee in basis points), optional `confidentiality` (`public`/`basic`/`advanced`).
- Response `quote` includes `depositAddress`, `depositMemo`, `amountIn`, `amountOut`, `deadline`, `timeEstimate`. Quotes are signed (verifiable since 27 Jun 2026).
- Status values: `PENDING_DEPOSIT`, `PROCESSING`, `SUCCESS`, `INCOMPLETE_DEPOSIT`, `REFUNDED`, `FAILED`. Status is polled by deposit address; a tx hash can be submitted to speed things up. Confirm exact paths for tokens, status and submit in the docs.
- Asset IDs look like `nep141:<chain>-<address>.omft.near`; fetch them from the tokens endpoint, never type from memory.
- **Since 27 Oct 2026 all 1Click swaps settle confidentially** on the NEAR Private Shard; the API is unchanged, and `nearTxHashes` no longer has a hash for the swap itself.
- **Quote minimums:** 9 Sep 2026 — origin→origin swaps under $1,000 temporarily blocked on nine chains; 14 Sep — under $100 when the deposit is on Tron. "Deposits to and withdrawals from Intents are not affected." No end date found. Check which chains before planning small payments.
- **App fees:** the app-fees page says that without an API key you keep your whole fee and 1Click adds 25 bps; with a key your fee is split 50/50 with 1Click (minimums apply). HACKATHON.md says "without a key a 0.2% fee applies". Check the current docs.
- **No testnet for NEAR Intents.** Use dry quotes for development and mainnet with tiny amounts for live demos (only with the human's OK).

## Agent API (agent accounts on Intents)

- Each agent gets its own Intents account. The owner signs a spending policy once; the agent then acts inside it.
- Policy can cover allowed assets and actions, per-asset limits, allowed destinations, USD budgets, timelocks and weekly schedules (per the SDK README — confirm).
- Agent actions: `swap`, `transfer`, `withdraw`, `shield`, `unshield`, `sign`; operation proofs are returned.
- Backend only (Node 24+). Weeks old: no wallet signers, React hooks or retries; `verifyOperationProof` does not check the TDX hardware quote — verify that separately if you show it.
- Hackathon track brief: demo keys from https://partners.demo.agentsonintents.com/dashboard, base URL https://api.demo.agentsonintents.com; keys are temporary and rotate. Number of agents is capped by partner quota.

## NEAR AI Cloud

- OpenAI-compatible API at `https://cloud-api.near.ai/v1`; inference runs in TEEs (Intel TDX + NVIDIA confidential GPUs); attestation and response signatures can be verified; multimodal confidential inference announced Feb 2026.
- Builders get $10 credit via https://nearbuilders.org/join; staking NEAR can also earn inference credits.

## OutLayer

- Verifiable off-chain compute in Intel TDX with an attestation per run; callable from contracts or over HTTPS; agent wallets with spending-limit policies. Docs: https://docs.near.org/primitives/off-chain-compute/outlayer

## Things to avoid

- **Shade Agents v1** (known critical vulnerabilities). Shade Agent framework 2.0 exists (TypeScript only), but prefer NEAR AI Cloud / OutLayer / Agent API for this hackathon.
- Full-access keys in any agent process.

## Context worth knowing

- NEAR's message: "agent is a front-end, markets are the back-end" (Illia Polosukhin, 7 Oct 2026). Priorities: Intents as the main trading/settlement venue, confidential by default, AI agents as users, verifiable private AI.
- NEAR's "Agent Economy" post (13 Jul 2026) lists agent needs: identity and permissions, settlement, private inference, confidential execution, verifiability, liquidity, discovery.
- 1 Oct 2026: $3.8M exploit at the Omni bridge / Intents boundary; funds returned; service resumed.
- NEAR Business (20 Oct 2026): invite-only confidential multisig treasury; custom spending policies "in development".
- nearcore 2.14: universal accounts and `ml_dsa_verify`; mainnet voting 4–6 Nov.
