// Walks the Stellar edition's owner path over HTTP, the way the browser does,
// with a throwaway test key standing in for the owner's wallet (Freighter signs
// the same things). Needs a running Stellar-edition server (BURSAR_MODE=live,
// BURSR_CHAIN=stellar). Testnet only. Run: BURSR_URL=http://localhost:3100 npx tsx scripts/stellar-http-walk.ts
import { createHash } from "node:crypto";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { stellarExpertTx } from "../lib/stellar-vault";

const BASE = process.env.BURSR_URL ?? "http://localhost:3100";
const PASSPHRASE = "Test SDF Network ; September 2015";
let cookie = "";

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${data.error ?? ""}`);
  return data;
}

interface Prepared {
  correlationId: string;
  summary: string;
  intent: { standard: string; payload: { xdr: string; networkPassphrase: string; address: string } };
}

async function signAndSubmit(owner: Keypair, kind: string, amount?: string) {
  const p = await call<Prepared>("/api/owner/intent", { step: "prepare", kind, ...(amount ? { amount } : {}) });
  if (p.intent.standard !== "stellar-xdr") throw new Error("not a Stellar transaction");
  const tx = TransactionBuilder.fromXDR(p.intent.payload.xdr, PASSPHRASE);
  tx.sign(owner);
  const r = await call<{ status: string; failureCode: string | null; txHash?: string }>("/api/owner/intent", { step: "submit", correlationId: p.correlationId, signedData: { signedXdr: tx.toXDR() } });
  if (r.status !== "SUCCESS") throw new Error(`${kind}: ${r.status} ${r.failureCode}`);
  console.log(`  ✓ ${p.summary}  ${stellarExpertTx(r.txHash ?? "")}`);
}

async function main() {
  const owner = Keypair.random();
  console.log(`Owner (test key): ${owner.publicKey()}`);

  const c = await call<{ token: string; stellarMessage: string }>("/api/auth/challenge");
  const sig = owner.sign(createHash("sha256").update(Buffer.from("Stellar Signed Message:\n" + c.stellarMessage, "utf8")).digest());
  const who = await call<{ accountId: string }>("/api/auth/verify", { chain: "stellar", token: c.token, address: owner.publicKey(), signature: Buffer.from(sig).toString("base64") });
  console.log(`  ✓ signed in as ${who.accountId}`);

  // A tampered transaction must be refused: sign-in done, now try submitting something Bursr didn't prepare.
  await call("/api/owner/setup", { name: "Mama Put Kitchen" });
  console.log("  ✓ business set up");

  await signAndSubmit(owner, "agent_create");
  await signAndSubmit(owner, "test_usdc", "300000000"); // $30
  await signAndSubmit(owner, "fund", "200000000"); // $20
  await signAndSubmit(owner, "agent_freeze");
  await signAndSubmit(owner, "withdraw", "50000000"); // $5 back while paused
  await signAndSubmit(owner, "agent_unfreeze");

  const bad = await call<Prepared>("/api/owner/intent", { step: "prepare", kind: "withdraw", amount: "10000000" });
  const other = TransactionBuilder.fromXDR((await call<Prepared>("/api/owner/intent", { step: "prepare", kind: "withdraw", amount: "20000000" })).intent.payload.xdr, PASSPHRASE);
  other.sign(owner);
  const swapped = await call<{ status: string }>("/api/owner/intent", { step: "submit", correlationId: bad.correlationId, signedData: { signedXdr: other.toXDR() } });
  if (swapped.status !== "REFUSED") throw new Error("a different transaction than prepared was accepted");
  console.log("  ✓ a transaction other than the one Bursr prepared is refused");

  for (const page of ["/this-week", "/add-money", "/spending-rules", "/people", "/payments", "/records", "/agent", "/welcome"]) {
    const res = await fetch(BASE + page, { headers: { Cookie: cookie }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    if (res.status >= 500 || /Something went wrong|Application error/.test(html)) throw new Error(`${page} → ${res.status}`);
    const note = page === "/add-money" ? (html.includes("$15.00") ? " (shows $15.00 in the Bursr wallet)" : " (balance $15.00 NOT shown)") : "";
    console.log(`  ✓ ${page} → ${res.status}${note}`);
  }
  console.log("\nOwner walk passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
