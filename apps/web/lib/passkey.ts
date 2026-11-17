import { createPublicKey } from "node:crypto";
import { generateRegistrationOptions, verifyRegistrationResponse, type PublicKeyCredentialCreationOptionsJSON, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { convertCOSEtoPKCS } from "@simplewebauthn/server/helpers";
import { z } from "zod";
import { readEnv, type Env } from "./env";
import type { PrismaClient } from "./generated/prisma/client";
import { NotOwnerError } from "./owner-actions";
import { isOwnerSession, openPayload, sealPayload, type OwnerSession } from "./owner";
import { getAccountRecord, getBusiness } from "./store";

// The passkey that owns a business's agent wallet (live mode). Bursr registers
// it, as the Agent API asks ("Your app registers passkeys"), and keeps only its
// public parts; the private key never leaves the owner's device. The Agent API
// has no way to change an agent's owner, so a passkey can only be saved while
// the business has no agent wallet yet.

export const OwnerPasskeySchema = z.object({
  credentialId: z.string().min(1),
  /** ES256 public key, DER SPKI, base64url (the Agent API refuses COSE keys). */
  publicKey: z.string().min(1),
  rpId: z.string().min(1),
  origin: z.string().url(),
  /** Synced to a password manager (iCloud Keychain, Google Password Manager…) rather than kept on one device. */
  backedUp: z.boolean(),
  createdAt: z.string(),
});
export type OwnerPasskey = z.infer<typeof OwnerPasskeySchema>;

/** ES256 (COSE alg -7): the only key type the Agent API takes for passkey owners. */
const ES256 = -7;
const CHALLENGE_MS = 5 * 60 * 1000;
export const PASSKEY_CHALLENGE_COOKIE = "bursar_passkey_reg";

export class PasskeySetupError extends Error {}

/** The passkey domain and origin, from env. Passkeys need an https site whose hostname is the domain or under it. */
export function passkeyConfig(env: Pick<Env, "NEXT_PUBLIC_APP_URL" | "BURSAR_PASSKEY_RP_ID"> = readEnv()): { rpId: string; origin: string } {
  const url = new URL(env.NEXT_PUBLIC_APP_URL);
  if (url.protocol !== "https:") throw new PasskeySetupError("Passkeys need Bursr on an https:// address. Set NEXT_PUBLIC_APP_URL to it.");
  const rpId = env.BURSAR_PASSKEY_RP_ID ?? url.hostname;
  if (url.hostname !== rpId && !url.hostname.endsWith(`.${rpId}`)) {
    throw new PasskeySetupError("BURSAR_PASSKEY_RP_ID must be this site's hostname or a parent domain of it.");
  }
  return { rpId, origin: url.origin };
}

/** COSE public key (from registration) to base64url DER SPKI, as in the Agent API docs (Owner Accounts). */
export function spkiFromCose(cosePublicKey: Uint8Array<ArrayBuffer>): string {
  const point = convertCOSEtoPKCS(cosePublicKey); // 0x04 || x || y
  return createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: Buffer.from(point.subarray(1, 33)).toString("base64url"),
      y: Buffer.from(point.subarray(33, 65)).toString("base64url"),
    },
    format: "jwk",
  })
    .export({ format: "der", type: "spki" })
    .toString("base64url");
}

export async function getOwnerPasskey(db: PrismaClient): Promise<OwnerPasskey | null> {
  const row = await db.business.findUnique({ where: { id: "main" }, select: { ownerPasskey: true } });
  if (!row?.ownerPasskey) return null;
  return OwnerPasskeySchema.parse(JSON.parse(row.ownerPasskey));
}

async function assertCanSetPasskey(db: PrismaClient, owner: OwnerSession) {
  if (!isOwnerSession(owner) || owner.demo) throw new NotOwnerError("Sign in with your wallet first.");
  const business = await getBusiness(db);
  if (!business || business.ownerAccountId !== owner.accountId) throw new NotOwnerError();
  if (await getAccountRecord(db)) throw new PasskeySetupError("Your agent's wallet already has its owner. It can't be changed.");
  return business;
}

/** Step 1: the options for the browser's "create a passkey" prompt, and the sealed challenge to keep in a cookie. */
export async function registrationOptions(
  db: PrismaClient,
  owner: OwnerSession,
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; sealedChallenge: string }> {
  const business = await assertCanSetPasskey(db, owner);
  const { rpId } = passkeyConfig();
  const options = await generateRegistrationOptions({
    rpName: "Bursr",
    rpID: rpId,
    userName: business.name,
    userDisplayName: `${business.name} (Bursr)`,
    userID: new TextEncoder().encode(business.id),
    attestationType: "none",
    supportedAlgorithmIDs: [ES256],
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  const sealedChallenge = sealPayload({ k: "passkey_reg", challenge: options.challenge, owner: owner.accountId }, CHALLENGE_MS);
  return { options, sealedChallenge };
}

/** Step 2: checks the browser's answer and saves the passkey as the owner of the agent wallet to be created. */
export async function verifyRegistration(
  db: PrismaClient,
  owner: OwnerSession,
  response: RegistrationResponseJSON,
  sealedChallenge: string | undefined,
): Promise<OwnerPasskey> {
  await assertCanSetPasskey(db, owner);
  const sealed = sealedChallenge ? openPayload<{ k?: string; challenge?: string; owner?: string }>(sealedChallenge) : null;
  if (!sealed || sealed.k !== "passkey_reg" || !sealed.challenge || sealed.owner !== owner.accountId) {
    throw new PasskeySetupError("That took too long. Please create your passkey again.");
  }
  const { rpId, origin } = passkeyConfig();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: sealed.challenge,
    expectedOrigin: origin,
    expectedRPID: rpId,
    requireUserVerification: true,
    supportedAlgorithmIDs: [ES256],
  });
  if (!result.verified) throw new PasskeySetupError("Your passkey couldn't be checked. Please try again.");
  const info = result.registrationInfo;
  const passkey: OwnerPasskey = {
    credentialId: info.credential.id,
    publicKey: spkiFromCose(info.credential.publicKey),
    rpId,
    origin,
    backedUp: info.credentialBackedUp,
    createdAt: new Date().toISOString(),
  };
  await db.business.update({ where: { id: "main" }, data: { ownerPasskey: JSON.stringify(passkey) } });
  await db.auditEvent.create({
    data: { kind: "owner_passkey", actor: owner.accountId, message: "You created the passkey that controls your agent's wallet", data: JSON.stringify({ credentialId: passkey.credentialId, backedUp: passkey.backedUp }) },
  });
  return passkey;
}

/** The Agent API owner for a new agent wallet (agent_create). */
export function passkeyOwner(p: OwnerPasskey) {
  return { type: "passkey" as const, credential_id: p.credentialId, public_key: p.publicKey, rp_id: p.rpId, origin: p.origin };
}
