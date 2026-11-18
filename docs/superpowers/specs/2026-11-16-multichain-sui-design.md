# Multi-chain owners, starting with Sui — design

Date: 16 Nov 2026. Status: approved by the owner on 17 Nov 2026; built on branch `multichain-sui`.

## Goal

A person with a Sui wallet can connect it to Bursr, send money to their agent wallet from any chain, and use that money for payroll. The same shape must let us add more wallet families (Solana, EVM, Aptos, Stellar, …) quickly afterwards.

## Decisions

1. **One agent wallet for every owner, whatever chain they come from.** The money, the rules and payroll stay on the NEAR Intents Agent API account we already run with real money. It already takes deposits from any chain (one-time deposit address) and pays out to any chain. We do not build a Sui Move vault now. A vault can be added later as another backend behind the `AgentAccount` interface (`apps/web/lib/agent-account/types.ts`) if the Sui ecosystem asks for money held on Sui.
   - Why: each new chain then costs a sign-in adapter and a funding button, not a new rules contract to build and audit.
2. **A passkey owns the agent wallet for every new business.** The Agent API accepts three owner kinds: NEAR account, EVM wallet and passkey (SDK `OwnerWallet`; README: "The owner (NEAR account, EVM wallet or passkey)"). Sui is not one of them. We use a passkey for all new businesses, not only Sui ones, so there is one owner path to build and test.
   - The connected wallet is used only to sign in and to send money in.
   - Businesses that already exist keep their NEAR owner, because the Agent API has no call to change an agent's owner. The NEAR owner path stays in the code for them, but setup no longer offers it.
   - "Use my wallet instead" (NEAR/EVM owner) may come back later as an advanced option. It is out of scope here.
3. **Owner identity is chain-prefixed for new wallet families.** A Sui owner is `sui:0x<64 hex>`. NEAR owners keep their bare account ID (`alice.near`), so existing rows need no migration. `Business.ownerAccountId` and the tenant scoping in `lib/tenant.ts` keep working on this string.

## Known risks (accepted)

- **Lost passkey.** With no owner rotation in the Agent API, an owner who loses their passkey can no longer change rules, add payees, freeze or delete that agent wallet. Mitigations:
  - Setup tells the owner to save the passkey to iCloud Keychain or Google Password Manager so it syncs.
  - The rules screen shows where the passkey lives.
  - Answer from the docs (DECISIONS.md, 17 Nov): after a lost passkey, money can still leave only while the agent's grant lives (30 days in Bursr, 365 at most) and only to addresses already on the list. So `agent_create` always puts the owner's own payout address on the list.
- **Domain lock-in.** A passkey belongs to one domain (`rp_id`, a hostname or its parent) and one exact HTTPS `origin`. Owners depend on bursr.xyz (or the configured domain) to manage their agent wallet, so the domain must be final before the first owner signs up. `rp_id` and origin come from env, never from hard-coded values. The docs ask for "your site's exact HTTPS origin" and refuse passkey prompts inside another site's iframe, so testing passkey owners needs an HTTPS host (practice mode is unaffected).
- **SDK version.** Bursr pins `@near-intents-agent-api/sdk` 0.8.0; 0.9.2 is out. Its types still say deposit `confidential` defaults to false (the docs say true). Upgrade only as its own step with the full test suite.

## Pieces

Each piece has one job, a typed interface, and its own tests.

### 0. Doc checks (before code)

Look up and record in DECISIONS.md, quoting the doc line each time (AGENTS.md rules 1 and 11):
- Agent API: the passkey owner flow (`OwnerWallet` `passkey`, `webauthn` intent standard) for `agent_create`, `policy_update`, `grant_issue` and freeze/unfreeze, plus what happens to funds when the owner cannot sign.
- Agent API `deposit`: a deposit address on chain `sui` for the treasury token, and its status follow-up.
- Sui: the current wallet-connect library (`@mysten/dapp-kit-react`; the older `@mysten/dapp-kit` is deprecated, see DECISIONS.md 17 Nov), personal-message signing, server-side verification (`@mysten/sui`, including zkLogin signatures), and the USDC coin type on Sui mainnet, read from the token list rather than typed in.

If a doc disagrees with this spec, the doc wins. Note it in DECISIONS.md and update this spec.

### 1. Owner signer (`lib/owner-signer.ts`)

- A business records which owner it has:
  - `{ kind: "near", accountId, publicKey }` for existing businesses;
  - `{ kind: "passkey", credentialId, publicKey, rpId, origin }` for new ones.
- The passkey is stored on `Business.ownerPasskey` (it must exist before `agent_create`, when there is no agent record yet; DECISIONS.md 17 Nov). The owner kind follows from the data: passkey on file = passkey owner; agent and no passkey = NEAR owner.
- `lib/owner-intents.ts` builds the Agent API `owner` field from this record. Today it takes `owner.publicKey` from the sign-in session, which is NEAR-only.
- In the browser, a signer helper signs `generated.intent` with the NEAR wallet (`nep413`/`nep366`, unchanged) or the passkey (`webauthn` via `@simplewebauthn/browser`, as the Agent API README shows).
- Rule 3 still holds: the agent never holds an owner key, and the passkey never leaves the owner's device.

### 2. Wallet adapters (`lib/wallets/`)

One adapter per wallet family. Each has the same three jobs:
- **connect:** browser, returns an address;
- **verify sign-in:** server, checks a signed challenge and returns an owner ID;
- **one-tap fund:** browser, sends a token to a given deposit address from the connected wallet.

Adapters in this work:
- `near`: move today's code behind the interface, no behaviour change.
- `sui`: new.

### 3. Sui sign-in

- **Flow (owner's choice, 17 Nov):** Connect wallet → choose a chain (NEAR, Sui, later more) → pick a wallet from that chain's list (`components/connect-wallet.tsx`). Built with `@mysten/dapp-kit-core` (see DECISIONS.md).
- The sign-in page offers "Connect Sui wallet" next to NEAR, listing the Sui wallets the browser has (Wallet Standard via `@mysten/dapp-kit-core`, client-only).
- Flow:
  1. `/api/auth/challenge` issues the one-time challenge (unchanged).
  2. The wallet signs it as a personal message.
  3. `/api/auth/verify` accepts a `chain` field. For `sui` it verifies with Sui's verifier against the claimed address (lowercase `0x` + 64 hex, as in `lib/address.ts`).
  4. The session cookie stores the prefixed owner ID.
- `OwnerSession` gains `chain`. Its `publicKey` stays NEAR-only and is no longer used as the Agent API owner key for new businesses.
- Signed-out copy that says "Sign in with your NEAR wallet" becomes wallet-neutral.

### 4. Setup with a passkey

Setup runs the same steps for every wallet:
1. Connect wallet.
2. Name the business.
3. Create a passkey. The prompt says to save it to iCloud or Google.
4. Face ID / fingerprint signs `agent_create` and the starting rules.
5. Bursr issues the agent's grant.

The existing setup steps and the "go to the first open step" behaviour stay.

### 5. Adding money from Sui

- **Built 18 Nov:** "From my Sui wallet (one tap)" in Add money (`components/add-money.tsx`, `sendUsdcFromSui` in `components/wallet.ts`, `suiOneTap` in `lib/funding.ts`).

- **One tap:** the server gets the agent wallet's deposit address on Sui for the treasury token (Agent API `deposit`). The Sui wallet asks the owner to confirm a USDC transfer of the amount they typed (smallest units, bigint) to that address. The agent follows the deposit status and says when the money lands. If the owner's wallet holds less than they typed, the button says so before the wallet opens.
- **Any other chain:** deposit address + QR code, unchanged.
- The agent never pulls from the owner's wallet.

### 6. Paying people

No change. Sui is already a payout chain (DECISIONS.md, 9 Nov).

### 7. Taking money out

- **Built 18 Nov:** the owner's Sui address is "home" (`lib/home.ts`); money goes there as a swap into USDC on Sui then a withdraw (DECISIONS.md 18 Nov).

- "Move money back to my wallet" (DECISIONS.md, 11 Nov) withdraws today to the owner's NEAR account, which `buildPolicy` always puts on the allowed list.
- For a Sui owner, `buildPolicy` instead puts a `withdraw` destination on chain `sui` to their own Sui address on the list, and the button withdraws the treasury token there as USDC on Sui.
- The address comes from the signed-in owner ID, never from the agent (rule 4).

## Dry-run (practice mode)

- Practice mode stays keyless and unchanged for judges: the demo owner, simulated account and practice money.
- Wallet adapters and passkey signing are live-only.
- The practice sign-in screen may show the Sui option as text, but needs no wallet.

## Testing

- **Unit (Vitest):**
  - Sui sign-in verification: valid signature, wrong address, expired challenge, malformed body.
  - Owner-ID prefixing and tenant scoping (a `sui:` owner never sees a NEAR owner's business).
  - Owner-signer selection in `owner-intents`.
  - `buildPolicy` puts a Sui owner's own address (chain `sui`) on the allowed list, and never an agent-supplied one.
  - The one-tap fund amount check (bigint, token decimals from the token list).
- **`lib/boundaries.test.ts`:** agent-side code still never imports owner or signer modules.
- **Sui testnet:** sign-in end to end with a real Sui wallet.
- **Mainnet:** passkey setup and a ~$1 USDC one-tap deposit from the owner's Sui wallet. Only with the owner's explicit OK at that moment (AGENTS.md rule 2). There is no NEAR Intents testnet.

## Build order

1. Doc checks (piece 0).
2. Owner signer + passkey setup (pieces 1 and 4), for every chain.
3. Sui sign-in (pieces 2 and 3).
4. Sui one-tap funding and taking money out to the Sui wallet (pieces 5 and 7).
5. README "do X → see Y" steps and "Built with" updated (new libraries listed), `/ship-check`.

Each step ends with a report and the owner's OK before the next. Steps 2 and 4 touch keys and money.

## Out of scope

- A Sui Move vault.
- Wallet-owned (non-passkey) agent wallets for new businesses.
- Moving existing NEAR-owned businesses to passkeys.
- One business with several sign-in wallets.
- Solana/EVM/other adapters (next, using the same adapter shape).
