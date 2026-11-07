// npm run verify:ai: checks that the invoice reader runs in a TEE, following
// NEAR AI Cloud's verification docs. Prints every check, passed or failed.
import "./load-env";
import { verifyReader } from "../lib/attestation";

const r = await verifyReader();
console.log(`Model ${r.model}\nFresh nonce ${r.nonce}\n`);
if (r.error) console.log(`ERROR ${r.error}`);
for (const e of r.enclaves) {
  console.log(`${e.name}  (signer ${e.signingAddress})`);
  for (const c of e.checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.label}: ${c.detail}`);
}
console.log(`\n${r.verified ? "VERIFIED: every check passed." : "NOT VERIFIED: see the failed checks above."}`);
process.exit(r.verified ? 0 : 1);
