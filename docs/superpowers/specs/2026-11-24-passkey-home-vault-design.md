# Bursr on any chain: passkey sign-up, home-chain vaults, naira in and out — design

Date: 24 Nov 2026. Status: **draft, waiting for the owner's OK** (it touches contracts, keys and money). Branch `multichain-passkey`, from `stellar` at 7f21dc9.

## Goal

A business owner who has never used crypto can sign up, add naira, pay staff and suppliers, and cash out to naira without installing a wallet, saving a seed phrase or seeing a long address. The money and the spending rules live on the business's **home chain** (Stellar or Sui; NEAR stays as it is), so each ecosystem sees the whole payment run on its own chain. Payees on other chains are paid through NEAR Intents.

Targets: the Stellar buildathon (Stellar edition) and the Sui product hunt (Sui edition). Both run on **mainnet**.

## Decisions (owner, 24 Nov 2026)

1. **A passkey replaces the wallet connect.** At sign-up the owner creates one passkey (Face ID / fingerprint). It signs them in and owns the business's vault. Connecting a wallet becomes an optional "Add money from a crypto wallet".
2. **One vault per business on its home chain.** It holds USDC and enforces the rules: per-payment cap, weekly cap, approved payees, emergency stop, no double pay. Stellar: the existing Soroban vault. Sui: a new Move vault with the same rules. This replaces the 16 Nov decision that kept a Sui owner's money on NEAR.
3. **Mainnet for Stellar and Sui.** Each mainnet deploy, signature or real spend still needs the owner's explicit OK at that moment (AGENTS.md rule 2).
4. **Cap per vault: about $500**, held in the contract where the chain allows it (see "Balance cap" for the Stellar limit), and shown in plain words in the app until the contracts are reviewed.
5. **Naira in and out through Linq** (Sui for sure; Stellar if Linq confirms USDC). Linq is mainnet-only with no sandbox, so practice mode uses a stand-in.
6. **NEAR Intents (1Click) for payees on other chains.**
7. **Bursr pays the network fees.** The owner holds only USDC.

## Facts from the docs (24 Nov 2026)

Each item was checked against the page quoted. Items marked *inferred* are our reading, not a doc statement.

**Stellar**
- Passkey verification: host function `verify_sig_ecdsa_secp256r1`, CAP-0051, "Status: Final", "Protocol version: 21". Signature "64-bytes … R-value … S-value". WebAuthn payload: "concatenating the webauthn authenticator data, and a SHA-256 hash of the client data JSON". The host refuses high-S signatures (rs-soroban-env `crypto/mod.rs`: "ECDSA signature 's' part is not normalized to low form"), so S must be normalised.
- Contract accounts: "A contract that implements the `CustomAccountInterface` and `__check_auth` becomes a contract account" (developers.stellar.org …/authorization). The host handles replay protection ("no need for a contract to manage its own nonces").
- Ready-made passkey accounts (developers.stellar.org …/smart-wallets):
  - Smart Account Kit (`stellar/smart-account-kit`, Apache-2.0), built on the audited OpenZeppelin `stellar-contracts` (MIT).
  - Passkey Kit (MIT), which the same guide says has "not been independently audited".
- Fees: "contract accounts can't sign transaction envelopes, so a separate G-account must act as the transaction source"; "a fee-bump on its own doesn't cover a contract account's fees". The relayer flow: "The user signs only the authorization entries … The relayer rebuilds the transaction with its own G-account as the source account, pays the fees" (…/fee-sponsorship).
  - Launchtube: "the Stellar Development Foundation has discontinued the Launchtube service".
  - OpenZeppelin Relayer is "open source (AGPL-3.0)". Stellar Channels: "OpenZeppelin runs the pool of channel accounts and covers the fees, subject to a fair use policy" (…/openzeppelin-relayer).
- USDC mainnet: issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`, SAC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`, 7 decimals (developers.circle.com usdc-contract-addresses; developers.stellar.org …/cross-chain-transfers).

**Sui**
- Passkeys "now live on Sui Mainnet" (sui.io blog, 7 Aug 2025). SIP-9 ("Status | Final"): address = `blake2b_hash(0x06 || pk)`; "The signature must have its `s` in the lower half of the curve order".
- SDK: `PasskeyKeypair` from `@mysten/sui/keypairs/passkey`. Creating a new key "creates a fresh new wallet with new address". Recovering the public key later needs "exactly two passkey signatures" (sdk.mystenlabs.com …/signers/passkey).
- *Inferred:* one passkey means one address, with no key rotation. For recovery the docs point to multisig (docs.sui.io …/passkeys).
- Sponsored transactions: "someone other than the sender pays for gas". Flow: `setSender`, `setGasOwner`, `setGasPayment`, then `signatures: [userSignature, sponsorSignature]` (sdk.mystenlabs.com …/signing-and-execution). `@mysten-incubation/sponsor` is "experimental".
- Move: `sui::ecdsa_r1::secp256r1_verify` exists. No doc covers checking a WebAuthn assertion inside Move. We don't need to: the owner's passkey address is the **sender** of owner transactions.
- USDC mainnet: `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC`, 6 decimals (Circle; decimals from the 1Click token list).

**NEAR Intents 1Click**
- Stellar and Sui are both "✅ Fully supported" (docs.near-intents.org …/chain-support).
- Origin from Sui works: dry quote, 10.0 USDC on Sui → 9.99558 USDC on Base, about 27 s.
- Origin from Stellar needs memo deposit mode (OpenAPI: "some (for example `stellar`) only `MEMO`"). The dry quote refused a contract `C…` address as `refundTo` ("refundTo is not valid").
- A Soroban vault can't attach a transaction memo. Whether 1Click accepts a muxed (M-address) transfer is undocumented. **So Stellar → other chains is open** (see Open questions).

**Linq** (from integrators' code, not Linq's own docs. Confirm with Linq.)
- B2B cash-out (`/b2b/offramp`, `/b2b/status`, `/b2b/rate`) uses an API key and HMAC webhooks. It returns a locked rate and a one-time deposit address valid for about 10 minutes.
- USDC/USDSUI on Sui → naira to a Nigerian bank. Mainnet only, no sandbox. One integrator reports a ₦200,000 cap per payout.
- Stellar: the main API may take XLM only. USDC on Stellar runs through a separate `linq-stellar` service (single-use G accounts with a USDC trustline, no memo).
- Naira in through the B2B API is **unconfirmed**.

## Design

### One passkey, every chain

- Sign-up: the owner creates a WebAuthn passkey with `rp_id` `bursr.xyz` (already fixed, see memory/DECISIONS 17 Nov). The same credential works on `stellar.bursr.xyz` and `sui.bursr.xyz`.
- Bursr stores the credential ID and public key (SPKI and raw 65-byte form). Sign-in checks a WebAuthn assertion against a server nonce (extends `lib/passkey.ts`).
- Backup device: the owner can add a second passkey from Settings. It becomes a second owner on the vault (both chains support this, see below).
- The owner never sees an address. Payees are shown by name. An address appears only in "Details" for people who ask.

### Stellar: owner = passkey smart account, vault unchanged in spirit

- The owner's account is an OpenZeppelin smart account (via Smart Account Kit) with the passkey as signer. Its `C…` address is the vault's `owner`.
- The existing vault already does `cfg.owner.require_auth()`, so owner calls are authorised by the passkey through the smart account's `__check_auth`. We don't write our own WebAuthn code on Stellar; we use the audited OZ base.
- Fees: owner transactions go through **OpenZeppelin Stellar Channels** (managed; avoids hosting AGPL code). The agent's own G-account pays its own `pay` fees from a small XLM float Bursr tops up.
- Vault changes (`contracts/bursr-stellar-vault`):
  - `max_balance` in the config, set at construction and changeable by the owner up to the cap.
  - `owner_pay(items: Vec<(BytesN<32>, Address, i128)>)`: owner only, one signature for a batch. Used for payees with fresh addresses (Linq orders, 1Click deposits). Uses the same used-key set as `pay`, so nothing is paid twice.
  - Everything else stays: `update`, `withdraw`, `set_agent`, `pay`, `status`, `is_payee`, `paid`.

### Sui: new Move vault `contracts/bursr-sui-vault`

Shared object `Vault<phantom T>`. Fields:
- `balance: Balance<T>`
- `owners: vector<address>` (passkey addresses, at most 3)
- `agent: address`
- `per_payment_cap`, `weekly_cap`, `max_balance`, `frozen`
- `window_start_ms`, `spent`
- `payees: Table<address, bool>`, `paid: Table<vector<u8>, bool>`

| Function | Who (checked as `ctx.sender()`) | What |
|---|---|---|
| `create(owner, agent, caps, max_balance, payees)` | owner (sponsored) | shares a new vault |
| `deposit(coin)` | anyone | refuses if the balance would exceed `max_balance` |
| `update(per, weekly, frozen, add, remove)` | an owner | same as Stellar |
| `withdraw(amount, to)` | an owner | works while frozen |
| `owner_pay(keys, tos, amounts)` | an owner | batch to fresh addresses |
| `add_owner` / `remove_owner` | an owner | backup passkey; never removes the last |
| `set_agent(addr)` | an owner | replace a lost agent key |
| `pay(key, payee, amount, clock)` | agent | same refusal order as Stellar: BadAmount, AlreadyPaid, Frozen, NotPayee, OverPaymentCap, OverWeeklyCap, LowBalance |

- Owner transactions are signed with `PasskeyKeypair` in the browser; Bursr's gas account sponsors them. The agent's key pays its own gas from a small SUI float.
- Coins sent straight to the vault's object address (not through `deposit`) don't count toward the balance. Bursr's add-money flow always calls `deposit`.

### Balance cap

- **Sui:** enforced in `deposit`.
- **Stellar:** a contract can't refuse an incoming token transfer. Bursr's add-money flow refuses amounts over the cap, and the vault's `status` reports when the balance is above `max_balance` so the app warns the owner.
- The app says "We hold up to $500 per business while our safety contract is being reviewed."

### Payments

| Payee | Who signs | Path |
|---|---|---|
| Same chain, on the approved list | agent, inside the caps | vault `pay` |
| Naira bank account (Linq) | owner, one tap per payout run | Linq order → vault `owner_pay` to the order's deposit address |
| Other chain (Sui home) | owner, one tap per run | 1Click quote → vault `owner_pay` to the deposit address |
| Other chain (Stellar home) | not yet | blocked on the memo question |

- Fresh deposit addresses can't go on the approved list, so the owner signs those runs (AGENTS.md rule 3: the AI never decides where money goes).
- Linq addresses expire in about 10 minutes, so the plan is approved first, then the one tap fetches the orders and signs the batch at once.

### Add money and cash out

- **Add money:** (a) naira through Linq if its B2B API can deliver USDC to the vault; otherwise (b) a "Buy USDC with naira in Linq, then send it here" guide with a QR code; (c) optional crypto wallet. The add-money path calls `deposit` on Sui.
- **Cash out:** owner taps "Cash out to my bank". Linq order → vault `withdraw` to the order's deposit address. Bank details are checked with Linq's account-name lookup before the owner confirms.
- **Practice mode:** a stand-in Linq (`LINQ_MODE=practice`) that returns a fake order and marks it paid. Live uses `LINQ_API_KEY` and `LINQ_WEBHOOK_SECRET` from `.env`.

### Code shape

- `BURSR_CHAIN` = `near | stellar | sui`. Chain-specific code moves under `apps/web/lib/chains/<chain>/`: sign-in, owner transactions, vault reads, add money.
- Payments still go only through `lib/agent-account.ts`, which gains `SuiVaultAccount`.
- New external-call modules, each with typed responses and timeouts: `lib/linq.ts`, `lib/stellar-relayer.ts`, `lib/sui.ts`.
- Sites: `stellar.bursr.xyz` (Stellar, mainnet), `sui.bursr.xyz` (Sui, mainnet), `bursr.xyz` (NEAR, unchanged).
- The README keeps the no-keys practice path first for AI judges.

## Milestones

1. **Stellar passkey sign-up**
   - Smart account deploy, Channels relayer, passkey sign-in, no wallet connect.
   - Vault `max_balance` and `owner_pay`, with Rust tests.
   - Practice mode end to end.
   - Mainnet wasm upload and the first vault after the owner's OK.
2. **Linq**
   - Stand-in first; live once the API key arrives.
   - Cash-out, naira payout runs, add-money option (a) or (b) depending on Linq's answer.
3. **Sui vault**
   - Move package and tests, `PasskeyKeypair` owner, sponsored gas, `SuiVaultAccount`.
   - 1Click payouts from Sui, Linq on Sui.
   - Mainnet publish after the owner's OK.
4. **Stellar → other chains** once the memo question is answered.

## Open questions

- Linq (message sent to the founder):
  - Can the B2B API deliver naira → USDC to an address we give it?
  - Is USDC on Stellar in `/b2b/offramp`?
  - Is KYB done once for Bursr, or per business?
  - Fees and limits?
- 1Click from a Soroban vault: does a SAC transfer to a muxed address satisfy the memo? If not, an owner-signed hop through a sponsored G account adds a custody step we must design carefully.
- Stellar Channels fair-use limits at mainnet volume.
- Do we need a review of `bursr-sui-vault` and the vault changes before raising the $500 cap? (Yes, before raising it.)
