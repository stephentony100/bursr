import { createHash, randomBytes } from "node:crypto";
import { getCollateralAndVerify, getCollateralFromPcs, verify, type VerifiedReport } from "@phala/dcap-qvl";
import { z } from "zod";
import { readEnv } from "./env";
import { DEFAULT_READER_MODEL } from "./reader";

// Proof that invoices are read inside a TEE. Follows NEAR AI Cloud's
// verification docs step by step (docs.near.ai/cloud/verification/cloud-api/
// model-attestations and …/reference/quote-nonce-signer):
//   fresh 32-byte nonce → GET /v1/attestation/report (provider=near,
//   x-no-aliasing) → for the gateway and every model candidate: Intel TDX quote
//   verified with dcap-qvl, not in debug mode, report data binds signer + our
//   nonce, echoed nonce matches, MRCONFIGID = 01 ‖ sha256(app_compose) ‖ 0×15,
//   event log replays to RTMR3 → GPU evidence: nonce matches, NVIDIA NRAS says
//   x-nvidia-overall-att-result = true.
// Every step is reported, passed or failed; nothing is assumed.

export const ACCEPTED_TCB_STATUSES = ["UpToDate"]; // the docs' example policy

export interface Check {
  label: string;
  ok: boolean;
  detail: string;
}

export interface EnclaveResult {
  name: string;
  signingAddress: string;
  checks: Check[];
}

export interface AttestationResult {
  model: string;
  nonce: string;
  at: string;
  verified: boolean;
  enclaves: EnclaveResult[];
  error?: string;
}

const Report = z.looseObject({
  signing_address: z.string(),
  signing_algo: z.string(),
  intel_quote: z.string(),
  event_log: z.unknown(),
  request_nonce: z.string(),
  info: z.looseObject({ tcb_info: z.unknown() }),
  nvidia_payload: z.string().optional(),
  model_name: z.string().optional(),
});
type Report = z.infer<typeof Report>;

const Body = z.looseObject({ gateway_attestation: Report, model_attestations: z.array(Report).optional() });

const hexBytes = (v: string) => Buffer.from(v.replace(/^0x/i, ""), "hex");
const parse = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
const hash = (alg: string, ...parts: (Buffer | string)[]) => {
  const h = createHash(alg);
  for (const p of parts) h.update(p);
  return h.digest();
};

export function replayRtmr3(eventLog: unknown): Buffer {
  let rtmr3 = Buffer.alloc(48);
  for (const e of parse(eventLog) as { imr: number; event_type: number; event: string; event_payload?: string; digest?: string }[]) {
    if (e.imr !== 3) continue;
    const type = Buffer.alloc(4);
    type.writeUInt32LE(e.event_type);
    const digest = hash("sha384", type, ":", Buffer.from(e.event, "utf8"), ":", hexBytes(e.event_payload ?? ""));
    if (e.digest && !hexBytes(e.digest).equals(digest)) throw new Error(`digest mismatch for event ${e.event}`);
    rtmr3 = hash("sha384", rtmr3, digest);
  }
  return rtmr3;
}

/** The expected first half of report data: the signer identity, zero-padded to 32 bytes (no TLS binding requested). */
export function boundIdentity(r: Pick<Report, "signing_address" | "signing_algo">): Buffer {
  const id = hexBytes(r.signing_address);
  if (({ ecdsa: 20, ed25519: 32 } as Record<string, number>)[r.signing_algo] !== id.length) throw new Error("unsupported signing identity");
  return Buffer.concat([id, Buffer.alloc(32 - id.length)]);
}

export function expectedMrConfigId(appCompose: string): Buffer {
  return Buffer.concat([Buffer.from([1]), hash("sha256", Buffer.from(appCompose, "utf8")), Buffer.alloc(15)]);
}

type Td10 = { tdAttributes: Uint8Array; reportData: Uint8Array; mrConfigId: Uint8Array; rtMr3: Uint8Array };

/** dcap-qvl with Phala's collateral server (its default); if that is unreachable, Intel's own PCS. */
async function verifyQuote(quote: Buffer): Promise<{ v: VerifiedReport; source: string }> {
  try {
    return { v: await getCollateralAndVerify(quote), source: "Phala PCCS" };
  } catch {
    const collateral = await getCollateralFromPcs(quote);
    return { v: verify(quote, collateral, Math.floor(Date.now() / 1000)), source: "Intel PCS" };
  }
}

async function checkReport(name: string, r: Report, nonce: string): Promise<EnclaveResult> {
  const checks: Check[] = [];
  const add = (label: string, ok: boolean, detail: string) => checks.push({ label, ok, detail });

  let quote: Td10 | null = null;
  try {
    const { v, source } = await verifyQuote(hexBytes(r.intel_quote));
    const accepted = ACCEPTED_TCB_STATUSES.includes(v.status);
    add("Intel TDX quote is genuine and up to date", accepted, `dcap-qvl with ${source}: TCB status ${v.status}${v.advisory_ids.length ? `, advisories ${v.advisory_ids.join(", ")}` : ""}`);
    if (v.report.type !== "td10") add("Quote is a TDX report", false, `report type ${v.report.type}`);
    else quote = v.report.data as unknown as Td10;
  } catch (e) {
    add("Intel TDX quote is genuine and up to date", false, e instanceof Error ? e.message : String(e));
  }

  add("Echoed nonce matches ours", r.request_nonce.toLowerCase() === nonce.toLowerCase(), `sent ${nonce.slice(0, 12)}…, got ${r.request_nonce.slice(0, 12)}…`);

  const q = quote as Td10 | null;
  if (q) {
    add("Not running in debug mode", (q.tdAttributes[0] & 1) === 0, "TD attributes debug bit is 0");
    try {
      const expected = Buffer.concat([boundIdentity(r), hexBytes(nonce)]);
      add("Quote binds this signing key and our fresh nonce", Buffer.from(q.reportData).equals(expected), `signer ${r.signing_address} (${r.signing_algo})`);
    } catch (e) {
      add("Quote binds this signing key and our fresh nonce", false, e instanceof Error ? e.message : String(e));
    }
    try {
      const appCompose = (parse(r.info.tcb_info) as { app_compose: string }).app_compose;
      add("Measured configuration matches (MRCONFIGID)", Buffer.from(q.mrConfigId).equals(expectedMrConfigId(appCompose)), `sha256(app_compose) = ${hash("sha256", appCompose).toString("hex").slice(0, 16)}…`);
    } catch (e) {
      add("Measured configuration matches (MRCONFIGID)", false, e instanceof Error ? e.message : String(e));
    }
    try {
      const replayed = replayRtmr3(r.event_log);
      add("Runtime event log replays to RTMR3", replayed.equals(Buffer.from(q.rtMr3)), `RTMR3 ${replayed.toString("hex").slice(0, 16)}…`);
    } catch (e) {
      add("Runtime event log replays to RTMR3", false, e instanceof Error ? e.message : String(e));
    }
  }

  if (r.nvidia_payload) checks.push(...(await checkGpu(r.nvidia_payload, nonce)));
  return { name, signingAddress: r.signing_address, checks };
}

async function checkGpu(payloadText: string, nonce: string): Promise<Check[]> {
  const label = "NVIDIA GPU is a genuine confidential-computing GPU (NRAS)";
  try {
    const payload = JSON.parse(payloadText) as { nonce?: unknown };
    if (typeof payload.nonce !== "string" || payload.nonce.toLowerCase() !== nonce.toLowerCase()) {
      return [{ label: "GPU evidence carries our fresh nonce", ok: false, detail: "nonce mismatch; not sent to NVIDIA" }];
    }
    const res = await fetch("https://nras.attestation.nvidia.com/v3/attest/gpu", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: payloadText,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [{ label, ok: false, detail: `NRAS answered ${res.status}` }];
    const out = (await res.json()) as unknown[];
    const jwt = (out[0] as [string, string])[1];
    const claims = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    return [
      { label: "GPU evidence carries our fresh nonce", ok: true, detail: "nonce matches" },
      { label, ok: claims["x-nvidia-overall-att-result"] === true, detail: `x-nvidia-overall-att-result = ${String(claims["x-nvidia-overall-att-result"])}` },
    ];
  } catch (e) {
    return [{ label, ok: false, detail: e instanceof Error ? e.message : String(e) }];
  }
}

export async function verifyReader(model = readEnv().NEAR_AI_MODEL ?? DEFAULT_READER_MODEL): Promise<AttestationResult> {
  const env = readEnv();
  const nonce = randomBytes(32).toString("hex");
  const at = new Date().toISOString();
  try {
    const q = new URLSearchParams({ model, provider: "near", include_tls_fingerprint: "false", signing_algo: "ecdsa", nonce });
    const res = await fetch(`${env.NEAR_AI_BASE_URL.replace(/\/$/, "")}/attestation/report?${q}`, {
      headers: { Accept: "application/json", "x-no-aliasing": "true", ...(env.NEAR_AI_API_KEY ? { Authorization: `Bearer ${env.NEAR_AI_API_KEY}` } : {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`attestation report: HTTP ${res.status}`);
    const body = Body.parse(await res.json());
    const enclaves = [await checkReport("NEAR AI Cloud gateway", body.gateway_attestation, nonce)];
    const models = body.model_attestations ?? [];
    if (models.length === 0) {
      enclaves.push({ name: model, signingAddress: "", checks: [{ label: "Model evidence returned", ok: false, detail: "model_attestations[] is missing or empty" }] });
    }
    for (const m of models) enclaves.push(await checkReport(m.model_name ?? model, m, nonce));
    return { model, nonce, at, verified: enclaves.every((e) => e.checks.every((c) => c.ok)), enclaves };
  } catch (e) {
    return { model, nonce, at, verified: false, enclaves: [], error: e instanceof Error ? e.message : String(e) };
  }
}
