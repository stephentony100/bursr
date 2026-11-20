# Bursr on Stellar — design

Date: 20 Nov 2026. Status: approved by the owner on 20 Nov 2026; built on branch `stellar`.

## Goal

A Stellar edition of Bursr on https://test.bursr.xyz for the Stellar Builders Circle application and the Stellar buildathon (application closes 21 Nov 2026). It must do what the application says:

- Payroll and supplier payments settle in USDC on Stellar.
- The owner's safety rules run as a Soroban contract on the business wallet: weekly cap, per-payment limit, approved payee list, emergency stop. The AI agent can only pay inside those rules, whatever it decides.
- Every payment leaves an on-chain receipt the owner can export.
- Cash-out to naira through anchors is shown as a labelled "coming next" step, not built.

## Decisions (owner, 20 Nov 2026)

1. **Stellar-only build.** test.bursr.xyz runs the Stellar edition (`BURSR_CHAIN=stellar`). It replaces the Sui test build there. Production bursr.xyz (NEAR, live) is untouched.
2. **Testnet.** Test USDC and XLM only. No mainnet transactions.
3. **One Soroban vault contract per business** holds its USDC and enforces the rules. Rejected: OpenZeppelin smart account with policies (newer tooling, harder wallet setup, too risky for a day) and classic multisig (cannot enforce caps or a payee list).
4. **Fresh code.** UJIRA's main repo is proprietary to Qomira Labs, so nothing is copied from it.
5. **Anchors later.** The payee view shows "Cash out to naira — coming next".

## Facts from the docs (20 Nov 2026)

- `soroban-sdk` 29.0.1 (crates.io max stable). Stellar CLI 28.1.0 installed.
- `@stellar/stellar-sdk` 17.4.0 (npm latest).
- Stellar Wallets Kit 2.8.0, MIT, `StellarWalletsKit.init({modules: defaultModules()})`, `getAddress()`, `signTransaction(xdr, {networkPassphrase, address})` (package README).
- Circle testnet USDC: `USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (developers.circle.com/stablecoins/usdc-contract-addresses). Its Stellar Asset Contract on testnet: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (`stellar contract id asset`). USDC on Stellar has 7 decimals.

## Pieces

### 1. Contract `contracts/bursr-stellar-vault` (Rust, soroban-sdk 29)

State: `owner`, `agent`, `token`, `per_payment_cap`, `weekly_cap`, `frozen`, `window_start`, `spent_in_window`, payee set, used payment keys. Amounts are `i128` in the token's smallest units.

| Function | Who | What |
|---|---|---|
| `__constructor(owner, agent, token, per_payment_cap, weekly_cap)` | deployer | sets everything, not frozen |
| `add_payee(addr)` / `remove_payee(addr)` | owner | changes the approved list |
| `set_limits(per, weekly)` | owner | changes the caps |
| `freeze()` / `unfreeze()` | owner | emergency stop |
| `withdraw(to, amount)` | owner | takes money out (works while frozen) |
| `set_agent(addr)` | owner | replaces a lost agent key |
| `pay(key: BytesN<32>, payee, amount) -> i128` | agent | pays one approved payee |
| `status()` | anyone | owner, agent, token, caps, frozen, spent, window start, balance |
| `is_payee(addr)`, `paid(key)` | anyone | reads |

`pay` refuses with a typed contract error, checked in this order: `Frozen`, `NotPayee`, `OverPaymentCap`, `OverWeeklyCap`, `AlreadyPaid`, `BadAmount` (≤ 0). The week is a 7-day window: when `now ≥ window_start + 7 days` the window restarts at `now` and `spent` resets. A successful `pay` transfers the token from the vault to the payee and emits a `paid` event (key, payee, amount). The agent never changes payees or limits (AGENTS.md rules 3 and 4).

Tests: one Rust test per rule, plus withdraw-while-frozen, window reset and non-owner/non-agent auth failures.

The wasm is uploaded to testnet once; its hash goes in env (`STELLAR_VAULT_WASM_HASH`). Each business deploys its own instance during setup, signed in the owner's wallet.

### 2. Stellar client (`lib/stellar.ts`)

The one module for Stellar RPC and Horizon calls (AGENTS.md conventions): typed responses, timeouts. It builds and simulates contract calls, submits and polls transactions, reads balances and trustlines, and funds testnet accounts with friendbot.

### 3. Payment backend (`lib/agent-account/stellar.ts`)

`StellarVaultAccount implements AgentAccount`, chosen in `lib/agent-account.ts` when `BURSR_CHAIN=stellar`.
- `status()`: reads `status()` from the contract and maps it to `AccountStatus` (backend `"stellar"`).
- `preview(req)`: simulates `pay`; a contract error becomes a plain-English refusal.
- `execute(req, key)`: `key` = sha256(idempotency key). It signs `pay` with the agent's key and submits. The contract's `AlreadyPaid` means the same key never pays twice.
- `outcome(id)`: transaction status from RPC; done gives the tx hash for the receipt.

The agent key is a Stellar keypair made per business, sealed in the database with `BURSAR_DATA_KEY` (same as the grant store) and funded with testnet XLM by friendbot.

### 4. Owner sign-in and actions

- Sign in with any Stellar wallet through Stellar Wallets Kit. The wallet signs Bursr's sign-in message (same text and nonce check as Sui); the server checks it against the G-address. Owner ID: `stellar:G…`.
- Setup: Bursr makes the agent key, then the owner signs one transaction that deploys their vault with the starter limits.
- Owner actions (add/remove payee, limits, freeze, withdraw, add money) follow one pattern: the server builds the transaction, the owner signs it in the wallet, and the server submits it and records the result. No code path lets the agent do these.
- Add money: one tap sends USDC from the owner's wallet into the vault. A "Get test USDC" link goes to Circle's faucet, and the owner's wallet is funded with test XLM if empty.

### 5. Payees and receipts

- Payee addresses are Stellar G-addresses. Bursr checks for a USDC trustline on Horizon and, if there isn't one, tells the owner in plain words that the payee must add USDC to their wallet first.
- Each payment links to its stellar.expert testnet transaction. The CSV statement includes the tx hash.
- The payee view shows "Cash out to naira — coming next".

### 6. What the Stellar edition hides

NEAR Intents, 1Click, the NEAR/Sui wallet picker, deposit addresses on other chains, the 0.5% Bursr fee. NEAR AI Cloud stays as the AI model behind the invoice reader and chat (it is an OpenAI-compatible API).

## Deploy

- Branch `stellar` (off `multichain-sui`), exported with `git archive` (the main `.env` is live), deployed to the Railway `test` environment behind test.bursr.xyz with its own database file. Ask the owner before deploying or pushing.
- Env: `BURSR_CHAIN=stellar`, `STELLAR_NETWORK=testnet`, `STELLAR_RPC_URL`, `STELLAR_HORIZON_URL`, `STELLAR_VAULT_WASM_HASH`, `STELLAR_USDC_CONTRACT`, `STELLAR_USDC_ISSUER`. All listed in `.env.example`, no secrets.

## Acceptance (testnet, end to end)

1. Owner signs in with a Stellar wallet and creates a vault.
2. Owner adds money.
3. Agent pays an approved payee → paid, with a stellar.expert link.
4. Agent tries a payee not on the list, an amount over the cap, and a payment while frozen → each refused by the contract.
5. `npm test` and the contract tests pass.

## Risks

- C: has about 1.4 GB free; a Rust build can need several hundred MB.
- Stellar Wallets Kit has to run in the Next.js client bundle only.
- Payees need a USDC trustline before they can be paid.
