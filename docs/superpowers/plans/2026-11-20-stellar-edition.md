# Bursr on Stellar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bursr's live mode runs on Stellar testnet: owners sign in with a Stellar wallet, a per-business Soroban vault holds USDC and enforces the rules, and the agent pays approved payees from it.

**Architecture:** A Soroban contract (`contracts/bursr-stellar-vault`) enforces caps, payee list, freeze and no-double-pay. The app keeps its existing shapes: the agent pays through `AgentAccount` (new backend `StellarVaultAccount`), and the owner changes things through the existing "prepare → wallet signs → submit" route (`/api/owner/intent`). In Stellar mode, prepare returns a transaction XDR (standard `stellar-xdr`) instead of an Agent API intent. The app's `Policy` JSON stays the source of "what the owner wants"; it is mapped onto the contract.

**Tech Stack:** Rust + soroban-sdk 29.0.1, Stellar CLI 28.1, `@stellar/stellar-sdk` 17.4.0, `@creit.tech/stellar-wallets-kit` 2.8.0, Next.js App Router, Prisma/SQLite, Vitest.

## Global Constraints

- Network: Stellar testnet only. Passphrase `Test SDF Network ; September 2015`. RPC `https://soroban-testnet.stellar.org`, Horizon `https://horizon-testnet.stellar.org`, friendbot `https://friendbot.stellar.org`.
- USDC: issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`, 7 decimals.
- Money is integers (bigint/i128). Never floats (AGENTS.md rule 6).
- The agent key can only call `pay`. Payees, limits, freeze, withdraw: owner signature only (rules 3, 4).
- Secrets only in `.env`; `.env.example` lists every new variable (rule 7).
- Dry-run (practice) mode and the NEAR live path keep working: Stellar mode is `BURSAR_MODE=live` + `BURSR_CHAIN=stellar`.
- Never run `npm run dev` in the main repo (its `.env` is live NEAR). Use a scratch clone or explicit env overrides.
- UI words plain; "Testnet" shown in Stellar mode; no "real money" wording.

## Files

| File | Job |
|---|---|
| `contracts/bursr-stellar-vault/` (Cargo.toml, src/lib.rs, src/test.rs) | the vault contract and its tests |
| `apps/web/lib/stellar.ts` | the one Stellar RPC/Horizon/friendbot module; tx build, simulate, submit, poll |
| `apps/web/lib/stellar-vault.ts` | pure mapping: Policy ⇄ contract args, contract error → Refusal, payment key |
| `apps/web/lib/stellar-signin.ts` | SEP-53 sign-in message check, owner ID `stellar:G…` |
| `apps/web/lib/stellar-owner.ts` | owner txs: create vault, update rules, freeze, add money, withdraw; prepare + submit |
| `apps/web/lib/agent-account/stellar.ts` | `StellarVaultAccount implements AgentAccount` |
| `apps/web/lib/env.ts`, `lib/agent-account.ts`, `lib/agent-account/types.ts`, `lib/owner-intents.ts`, `lib/tokens.ts`, `lib/chains.ts`, `lib/address.ts`, `lib/owner-id.ts`, `lib/home.ts`, `lib/starter-rules.ts` | Stellar branches |
| `apps/web/components/wallet.ts`, `connect-wallet.tsx`, `add-money.tsx`, `move-home.tsx`, `app/welcome/page.tsx`, `app/api/auth/*` | Stellar wallet UI |
| `scripts/stellar-upload-wasm`, `.env.example`, `README.md`, `docs/DECISIONS.md` | ops and docs |

---

### Task 1: Vault contract

**Files:** Create `contracts/bursr-stellar-vault/{Cargo.toml,src/lib.rs,src/test.rs}`, root `contracts/Cargo.toml` workspace if absent.

**Produces (contract interface, used by Tasks 3–5):**
- `__constructor(owner: Address, agent: Address, token: Address, per_payment_cap: i128, weekly_cap: i128)`
- `update(per_payment_cap: i128, weekly_cap: i128, frozen: bool, add: Vec<Address>, remove: Vec<Address>)` — owner
- `withdraw(to: Address, amount: i128)` — owner, works while frozen
- `set_agent(agent: Address)` — owner
- `pay(key: BytesN<32>, payee: Address, amount: i128) -> i128` — agent
- `status() -> Status { owner, agent, token, per_payment_cap, weekly_cap, frozen, window_start: u64, spent: i128, balance: i128 }`
- `is_payee(addr) -> bool`, `paid(key) -> bool`
- Errors (u32): `BadAmount=1, AlreadyPaid=2, Frozen=3, NotPayee=4, OverPaymentCap=5, OverWeeklyCap=6, LowBalance=7, BadLimits=8`. `pay` checks in that order.
- Week: 7 days (604800 s). When `now >= window_start + WEEK`, `window_start = now`, `spent = 0`. `status()` reports the effective (reset) values.
- Event on pay: topics `("paid", payee)`, data `(key, amount)`.

- [ ] Write tests first (`src/test.rs`) using `Env::default()`, `env.mock_all_auths()` where auth isn't the subject, a Stellar Asset Contract from `env.register_stellar_asset_contract_v2(admin)` minted to the vault. Tests: pays approved payee and moves balance; refuses each error in order; AlreadyPaid on repeat key; weekly window resets after 7 days (`env.ledger().with_mut(|l| l.timestamp += 604800)`); withdraw works while frozen; `update` without owner auth fails (`try_update` with no mocked auth → Err); `pay` without agent auth fails.
- [ ] Run `cargo test` in `contracts/bursr-stellar-vault` → fail (no impl).
- [ ] Implement `src/lib.rs`; config struct in instance storage; payees and paid keys in persistent storage; extend TTLs on write.
- [ ] `cargo test` → pass. `stellar contract build` → wasm in `target/wasm32v1-none/release/` (or `wasm32-unknown-unknown`).
- [ ] Commit.

### Task 2: Upload wasm to testnet

- [ ] `stellar keys generate bursr-deployer --network testnet --fund`.
- [ ] `stellar contract upload --wasm <wasm> --source bursr-deployer --network testnet` → wasm hash. Record in `.env.example` comment and DECISIONS.md (hash is public, not a secret).
- [ ] Smoke on testnet with the CLI: deploy one instance with owner/agent CLI keys, `status` → returns limits. Commit notes.

### Task 3: Pure mapping (`lib/stellar-vault.ts`) — TDD

**Produces:**
- `STELLAR_USDC: PayoutToken` = `{ assetId: "stellar:CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", symbol: "USDC", chain: "stellar", decimals: 7 }`
- `vaultLimits(policy: Policy): { perPaymentCap: bigint; weeklyCap: bigint; frozen: boolean; payees: string[] }` — per cap from `policy.limits.per_transaction[STELLAR_USDC.assetId]`, weekly from `budget.weekly_usd` (USD string → 7-decimal units), payees = destinations with chain `stellar`.
- `payeeDiff(want: string[], have: string[]): { add: string[]; remove: string[] }`
- `refusalForVaultError(code: number): Refusal` — 3→`wallet_frozen`, 4→`policy_destination_denied`, 5→`policy_transaction_limit_exceeded`, 6→`spend_budget_exceeded`, 7→`insufficient_balance`, 1/8→`unsupported_token`, with the same plain-English messages as `evaluate.ts`.
- `paymentKey(idempotencyKey: string): Buffer` — sha256, 32 bytes.
- [ ] Tests in `lib/stellar-vault.test.ts` for each; implement; `npx vitest run lib/stellar-vault.test.ts` → pass; commit.

### Task 4: Stellar client (`lib/stellar.ts`) and env

**Produces:** `stellarConfig()`, `rpc()`, `fundWithFriendbot(address)`, `accountExists(address)`, `hasUsdcTrustline(address)`, `usdcBalance(address)`, `simulateCall({source, contractId, method, args})`, `prepareCall(...)` → assembled `Transaction`, `submitSigned(xdr)` → `{hash}`, `waitForTx(hash)` → `{state, returnValue?}`, `vaultContractIdFor(owner, salt)`, `prepareDeployVault({owner, agent, perPaymentCap, weeklyCap, salt})`.
- Env: `BURSR_CHAIN` (`near`|`stellar`, default `near`), `STELLAR_RPC_URL`, `STELLAR_HORIZON_URL`, `STELLAR_NETWORK_PASSPHRASE`, `STELLAR_VAULT_WASM_HASH`, `STELLAR_USDC_CONTRACT`, `STELLAR_USDC_ISSUER` with the testnet defaults above. Add to `.env.example`.
- [ ] Add `@stellar/stellar-sdk@17.4.0` to apps/web. Env tests in `env.test.ts`. Unit-test pure parts (contract id derivation against `stellar contract id` CLI output for a fixed deployer+salt). Commit.

### Task 5: Agent backend (`lib/agent-account/stellar.ts`)

- `backend: "stellar"` added to `AgentAccount`/`AccountStatus` unions.
- `status()`: simulate `status`, map to `AccountStatus` (policy = stored policy, spent in USD micros = spent rescaled 7→6, `weekResetsAt` = window_start+7d or null, balances `{[STELLAR_USDC.assetId]: balance}`).
- `preview(req)`: non-withdraw kinds → refusal `policy_action_denied`; simulate `pay` with key = paymentKey("preview"); contract error → `refusalForVaultError`.
- `execute(req, key)`: simulate first (refusal path), else sign with agent keypair, submit; `correlationId` = tx hash. `AlreadyPaid` → `{status:"accepted", correlationId:"already-paid:"+key}`.
- `outcome(id)`: `already-paid:` → done; else `waitForTx` once (no long wait) → done with txHash / failed / pending.
- `lib/agent-account.ts`: in live mode with `BURSR_CHAIN=stellar`, build it from the account record (`agentId` = vault contract id, agent secret = `readGrant(record)`).
- [ ] Tests with a stubbed client (`refusal mapping`, `already-paid`, `swap refused`). Commit.

### Task 6: Owner transactions (`lib/stellar-owner.ts`) wired into `/api/owner/intent`

- `prepareOwnerIntent` in Stellar mode → `prepareStellarOwnerTx(db, owner, kind)`; kinds: `agent_create` (new agent keypair, friendbot it, deploy vault; keep `{agentSecret, contractId}` pending by correlationId = tx hash), `policy_update` (`update` with diff from stored on-chain payees), `agent_freeze`/`agent_unfreeze` (`update` with frozen flag), `grant_issue` → error "not needed on Stellar". Returns `PreparedIntent` with `intent: { standard: "stellar-xdr", payload: { xdr, networkPassphrase } }`, `correlationId` = tx hash, `agentId` = vault id.
- `submitOwnerIntent` in Stellar mode → verify the signed tx's hash equals the prepared hash, submit, wait; on success write `AgentAccount { backend: "stellar", agentId: vaultId, policy, grantSealed: sealGrant(agentSecret, vaultId), grantExpiresAt: null }` (create) or update policy; then same audit/trust steps as the Agent API path.
- Extra kinds via new route `/api/owner/stellar-money`: `fund` (SAC `transfer(owner → vault, amount)`) and `withdraw` (vault `withdraw(owner, amount)`), same prepare/submit pattern, amount in USDC units.
- [ ] Tests for the hash check and kind mapping with a stubbed client. Commit.

### Task 7: Sign-in, tokens, addresses

- `lib/owner-id.ts`: chain `stellar` for `stellar:G…`; label shortens the G-address.
- `lib/stellar-signin.ts`: message = `suiSignInMessage`-style text; verify SEP-53: `Keypair.fromPublicKey(G).verify(sha256("Stellar Signed Message:\n" + message), sig)`; also accept a signature over the raw message bytes. Tests with a generated keypair.
- `/api/auth/verify`: `chain: "stellar"` branch; `/api/auth/challenge`: add `stellarMessage`. On first sign-in, friendbot-fund the owner if the account doesn't exist.
- `lib/tokens.ts`: Stellar mode → `[STELLAR_USDC]`. `lib/chains.ts`: `stellar: "Stellar"`. `lib/address.ts`: `stellar` → `StrKey.isValidEd25519PublicKey`. `lib/home.ts`: Stellar owner home = their G-address in STELLAR_USDC. `lib/starter-rules.ts`: Stellar mode treasury/payout = STELLAR_USDC, no fee.
- Payee add: if no USDC trustline, refuse with "This wallet can't receive USDC yet. Ask them to add USDC (Circle) to their Stellar wallet, then try again."
- [ ] Tests; commit.

### Task 8: Browser wallet

- `components/wallet.ts`: Stellar Wallets Kit (dynamic import, client only): `stellarWallets()`, `signInWithStellar(walletId)`, `signStellarXdr(xdr, address)`; `signAndSubmitIntent` handles `standard === "stellar-xdr"` → `signedData = { signedXdr }`.
- `connect-wallet.tsx`: in Stellar mode show Stellar wallets only (prop from server `chain`).
- `add-money.tsx`: Stellar mode → "Add USDC from my wallet" (amount → `/api/owner/stellar-money` prepare → sign → submit), "Get test USDC" link `https://faucet.circle.com`, vault address with copy.
- `move-home.tsx`: Stellar → withdraw to owner's wallet via the same route.
- `app/welcome/page.tsx`: Stellar mode skips passkey and grant steps (vault creation gives the agent its key).
- Payment rows: link `https://stellar.expert/explorer/testnet/tx/<hash>`. Payee view: "Cash out to naira — coming next".
- [ ] Typecheck + lint; commit.

### Task 9: End-to-end on testnet and deploy

- [ ] Scratch clone with `.env`: `BURSAR_MODE=live BURSR_CHAIN=stellar DATABASE_URL=file:./stellar.db`, fresh `BURSAR_DATA_KEY`/`BURSAR_SESSION_SECRET`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- [ ] Script `apps/web/scripts/stellar-e2e.ts` (CLI keys as owner): create vault, fund, pay approved payee (ok), pay unknown payee / over cap / frozen (each refused). Record tx hashes in DECISIONS.md.
- [ ] Browser walk with Freighter on testnet.
- [ ] `npm test`, `npm run lint`, typecheck, `/ship-check`.
- [ ] Ask the owner, then deploy to Railway `test` env (test.bursr.xyz) from `git archive stellar`, env vars as above, `DATABASE_URL=file:/data/stellar.db`.
- [ ] README section "Bursr on Stellar (testnet)" with numbered do→see steps.
