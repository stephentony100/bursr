import { createHash } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { convertCOSEtoPKCS } from "@simplewebauthn/server/helpers";
import { Address, Keypair, Operation, StrKey, xdr } from "@stellar/stellar-sdk";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma/client";
import { openPayload, sealPayload } from "./owner";
import { passkeyConfig } from "./passkey";
import { sendFeePaid, stellarConfig, waitForTx } from "./stellar";

// Stellar edition: an owner signs up with a passkey instead of a wallet.
// The browser's Smart Account Kit creates the passkey and a passkey account
// (an OpenZeppelin smart account contract whose signer is that passkey); Bursr
// checks what came back, sends the account's deploy with its fee account, and
// keeps the passkey's public key so the owner can sign in again later. The
// owner ID is `stellar:C…` (the passkey account). Bursr never holds the
// passkey's private key: it stays on the owner's device.

export const STELLAR_PASSKEY_COOKIE = "bursar_stellar_passkey";
const CHALLENGE_MS = 5 * 60 * 1000;
/** ES256: secp256r1, the only key Stellar's WebAuthn verifier checks. */
const ES256 = -7;

export class StellarPasskeyError extends Error {}

/** smart-account-kit's shared deployer (`DEFAULT_DEPLOYER_SEED` in its constants.js). It only signs; it never pays. */
export const KIT_DEPLOYER_PUBLIC_KEY = Keypair.fromRawEd25519Seed(sha256(Buffer.from("openzeppelin-smart-account-kit"))).publicKey();

function sha256(b: Uint8Array): Buffer {
  return createHash("sha256").update(b).digest();
}

/**
 * The passkey account's address for a credential: smart-account-kit's
 * `deriveContractAddress` (utils.js), redone with this app's Stellar SDK: the
 * deployer's contract-id preimage salted with sha256(credential ID bytes).
 */
export function passkeyAccountAddress(credentialId: Uint8Array, networkPassphrase: string, deployer = KIT_DEPLOYER_PUBLIC_KEY): string {
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId: sha256(Buffer.from(networkPassphrase)),
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({ address: Address.fromString(deployer).toScAddress(), salt: sha256(credentialId) }),
      ),
    }),
  );
  return StrKey.encodeContract(sha256(preimage.toXdr()));
}

/** What the browser's kit needs. Public values only; RPC goes through Bursr (app/api/stellar/rpc). */
export function kitSettings() {
  const { network, passphrase } = stellarConfig();
  const { rpId } = passkeyConfig();
  return { networkPassphrase: passphrase, accountWasmHash: network.accountWasmHash, webauthnVerifier: network.webauthnVerifier, rpId };
}

// --- Sign-up ---

/** Step 1: Bursr's own challenge for the passkey the kit is about to create, sealed for a cookie. */
export async function signUpOptions(businessName: string): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; sealed: string }> {
  const { rpId } = passkeyConfig();
  const options = await generateRegistrationOptions({
    rpName: "Bursr",
    rpID: rpId,
    userName: businessName,
    attestationType: "none",
    supportedAlgorithmIDs: [ES256],
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  return { options, sealed: sealPayload({ k: "stellar_signup", challenge: options.challenge }, CHALLENGE_MS) };
}

export const SignUpBody = z.object({
  response: z.custom<RegistrationResponseJSON>((v) => typeof v === "object" && v !== null && typeof (v as { id?: unknown }).id === "string"),
  contractId: z.string().regex(/^C[A-Z2-7]{55}$/),
  relayerPayload: z.object({ func: z.string().min(1).max(20_000), auth: z.array(z.string().min(1).max(20_000)).max(4) }),
});
export type SignUpBody = z.infer<typeof SignUpBody>;

/**
 * Step 2: checks the new passkey (our challenge, our domain, user verified),
 * that the kit's account is this passkey's (address derived from it, our
 * account code, the passkey's key in it), then sends the deploy from the fee
 * account and saves the passkey. Returns the owner ID.
 */
export async function completeSignUp(db: PrismaClient, body: SignUpBody, sealed: string | undefined): Promise<string> {
  const s = sealed ? openPayload<{ k?: string; challenge?: string }>(sealed) : null;
  if (!s || s.k !== "stellar_signup" || !s.challenge) throw new StellarPasskeyError("That took too long. Please create your passkey again.");
  const { rpId, origin } = passkeyConfig();
  const result = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge: s.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
    supportedAlgorithmIDs: [ES256],
  });
  if (!result.verified) throw new StellarPasskeyError("Your passkey couldn't be checked. Please try again.");
  const cred = result.registrationInfo.credential;
  const point = Buffer.from(convertCOSEtoPKCS(cred.publicKey)); // 0x04 || x || y
  const { passphrase, network } = stellarConfig();

  if (body.contractId !== passkeyAccountAddress(Buffer.from(cred.id, "base64url"), passphrase)) {
    throw new StellarPasskeyError("Your passkey account's address doesn't match your passkey.");
  }
  checkDeploy(body.relayerPayload.func, network.accountWasmHash, point);

  const existing = await db.stellarPasskey.findUnique({ where: { credentialId: cred.id } });
  if (existing?.status === "ready") throw new StellarPasskeyError("This passkey is already set up. Sign in with it instead.");
  await db.stellarPasskey.upsert({
    where: { credentialId: cred.id },
    create: { credentialId: cred.id, contractId: body.contractId, publicKey: Buffer.from(cred.publicKey).toString("base64url"), counter: cred.counter, backedUp: result.registrationInfo.credentialBackedUp },
    update: {},
  });

  const hash = await sendFeePaid(
    Operation.invokeHostFunction({
      func: xdr.HostFunction.fromXdr(body.relayerPayload.func, "base64"),
      auth: body.relayerPayload.auth.map((a) => xdr.SorobanAuthorizationEntry.fromXdr(a, "base64")),
    }),
  );
  const r = await waitForTx(hash, 40);
  if (r.state !== "done") throw new StellarPasskeyError("Stellar didn't confirm your passkey account yet. Please try again in a minute.");
  await db.stellarPasskey.update({ where: { credentialId: cred.id }, data: { status: "ready", lastUsedAt: new Date() } });
  return `stellar:${body.contractId}`;
}

/** The kit's deploy must create our passkey account code with this passkey's key in it, and nothing else. */
export function checkDeploy(funcB64: string, accountWasmHash: string, point: Buffer): void {
  let func: xdr.HostFunction;
  try {
    func = xdr.HostFunction.fromXdr(funcB64, "base64");
  } catch {
    throw new StellarPasskeyError("Your passkey account setup came back in an unexpected form.");
  }
  if (func.type !== "hostFunctionTypeCreateContractV2") throw new StellarPasskeyError("Your passkey account setup isn't a new account.");
  const exe = func.createContractV2.executable;
  if (exe.type !== "contractExecutableWasm" || Buffer.from(exe.wasmHash.value).toString("hex") !== accountWasmHash) {
    throw new StellarPasskeyError("Your passkey account isn't the account code Bursr uses.");
  }
  if (!Buffer.from(func.toXdr("raw")).includes(point)) throw new StellarPasskeyError("Your passkey account isn't controlled by your passkey.");
}

// --- Sign-in ---

/** A challenge for "sign in with your passkey"; the owner picks their passkey on the device. */
export async function signInOptions(): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; sealed: string }> {
  const { rpId } = passkeyConfig();
  const options = await generateAuthenticationOptions({ rpID: rpId, userVerification: "required", allowCredentials: [] });
  return { options, sealed: sealPayload({ k: "stellar_signin", challenge: options.challenge }, CHALLENGE_MS) };
}

/** Checks the passkey's answer against the saved public key. Returns the owner ID. */
export async function completeSignIn(db: PrismaClient, response: AuthenticationResponseJSON, sealed: string | undefined): Promise<string> {
  const s = sealed ? openPayload<{ k?: string; challenge?: string }>(sealed) : null;
  if (!s || s.k !== "stellar_signin" || !s.challenge) throw new StellarPasskeyError("That took too long. Please try again.");
  const row = await db.stellarPasskey.findUnique({ where: { credentialId: response.id } });
  if (!row || row.status !== "ready") throw new StellarPasskeyError("Bursr doesn't know this passkey. If you're new, create one to sign up.");
  const { rpId, origin } = passkeyConfig();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: s.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
    credential: { id: row.credentialId, publicKey: new Uint8Array(Buffer.from(row.publicKey, "base64url")), counter: row.counter },
  });
  if (!result.verified) throw new StellarPasskeyError("Your passkey couldn't be checked. Please try again.");
  await db.stellarPasskey.update({ where: { credentialId: row.credentialId }, data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  return `stellar:${row.contractId}`;
}
