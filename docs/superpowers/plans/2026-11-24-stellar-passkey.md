# Stellar passkey sign-up — implementation plan (milestone 1)

Spec: `docs/superpowers/specs/2026-11-24-passkey-home-vault-design.md`. Owner choices (24 Nov 2026): use Smart Account Kit despite it being unaudited (keep the $500 cap); Bursr's own fee account pays Stellar fees (not Stellar Channels).

## Facts relied on (smart-account-kit 0.10.0 README and `dist/*.d.ts`)

- `npm i smart-account-kit`, Apache-2.0. It carries its own `@stellar/stellar-sdk` 16. Our app stays on 17, so XDR crosses the boundary as base64 strings ("You cannot pass SDK 17 transaction objects to the kit").
- `createWallet(appName, userName, { autoSubmit: false })` makes the passkey (its own WebAuthn call, `rpId` from config) and returns `{ credentialId, contractId, relayerPayload: { func, auth } }`. Anyone funded may submit the payload ("through any funded source you control").
- The shared default deployer is sign-only: "Never use it as a fee source or fund it on mainnet."
- `StoredCredential.publicKey`: "65-byte secp256r1 uncompressed public key".
- `deriveContractAddress(credentialId, deployerPublicKey, networkPassphrase)`, `DEFAULT_DEPLOYER_PUBLIC_KEY`.
- Signing an SDK 17 transaction: "sign each auth entry with `kit.signAuthEntry`. Then re-simulate and submit the transaction with SDK 17."
- v0.8.0 account wasm `c514d35ea67eaea9bfc1fb3327854c0c06111bc1ddebd4fe217c504c1004b9e1`. WebAuthn verifier: testnet `CC7EKIHQP3TN4CARQDND6CEOY2UXLWWC2X5GHTD5NLAT7BG5GPZIOM3F`, mainnet `CB7HENHJ7NF34I5FFXQK7D5I3WWQRGB5O5XO77D3NXMT7LM7LOKRQ5YR` (docs/deployments-stellar-accounts-0.8-2026-10-25.md).

## Tasks

1. **Contract:** the constructor requires `owner.require_auth()`, so a new vault carries the owner's signature on its rules, whoever pays the fee. Test: constructing without owner auth fails.
2. **Env:**
   - `STELLAR_FEE_SECRET` (Bursr's fee account, secret, `.env` only).
   - `NEXT_PUBLIC_STELLAR_ACCOUNT_WASM_HASH` and `NEXT_PUBLIC_STELLAR_WEBAUTHN_VERIFIER`.
   - `STELLAR_FRIENDBOT_URL` may be empty (mainnet), and friendbot is skipped then.
   - The mainnet values go in `.env.example` comments.
3. **`lib/stellar.ts`:** fee-account helpers:
   - submit a host function with signed auth entries;
   - create a funded agent account;
   - build a call whose authorizer is a contract account, simulate it, and return its auth entries as base64;
   - re-assemble with signed entries, re-simulate, sign with the fee account and submit.
4. **`lib/stellar-passkey.ts` (server):**
   - Sign-up: check the kit's deploy payload (create-contract with the accepted wasm hash, address = `deriveContractAddress(credentialId, DEFAULT_DEPLOYER_PUBLIC_KEY, passphrase)`) and submit it with the fee account.
   - Bind credential ID + public key to the smart account, then verify a WebAuthn assertion against a server nonce (`@simplewebauthn/server`). The owner ID is `stellar:C…`.
   - Sign-in: the same assertion check against the stored key.
5. **`lib/stellar-owner.ts`:** passkey owners get auth entries to sign instead of a whole transaction.
   - The server checks the signed entry's root invocation is the one it built and its address is the owner's smart account.
   - Then it submits with the fee account.
   - `agent_create` deploys the vault from the fee account, with the owner's signed auth for the constructor.
6. **Browser `components/stellar-passkey.ts`:** a kit wrapper (`createWallet`, `connectWallet`, `signAuthEntry`). Sign-in and welcome pages say "Continue with a passkey"; connecting a wallet stays as a secondary option.
7. **Tests:** unit tests for the payload and entry checks. A testnet run on test.bursr.xyz by the owner with a real passkey before any mainnet step.
8. **Mainnet (owner's OK at each step):** fund the fee account, upload the vault wasm, then the first business.
