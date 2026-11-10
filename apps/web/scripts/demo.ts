// npm run demo: creates the local database if needed and loads the sample
// restaurant (dry-run only). Replaces earlier demo data; refuses to touch a
// database that belongs to a real (signed-in) owner.
import "./load-env";
import { execSync } from "node:child_process";
import { db } from "../lib/db";
import { DEMO_OWNER_ID } from "../lib/owner";
import { dbForOwner } from "../lib/tenant";
import { loadSampleBusiness } from "../lib/demo-loader";
import { chainName } from "../lib/tokens";

async function main() {
  execSync("npx prisma db push", { stdio: "pipe", env: { ...process.env, CHECKPOINT_DISABLE: "1" } });
  const { name, payees, invoices } = await loadSampleBusiness(await dbForOwner(db(), DEMO_OWNER_ID));
  console.log(`Loaded "${name}" (dry-run, demo money only).`);
  for (const p of payees) console.log(`  payee    ${p.name.padEnd(28)} ${p.payout.token.symbol} on ${chainName(p.payout.token.chain)}`);
  for (const i of invoices) {
    const problems = i.results.filter((r) => !["pass", "flag"].includes(r.status)).map((r) => r.check);
    const warnings = i.results.filter((r) => r.status === "flag").map((r) => r.check);
    const why = [problems.join(", "), warnings.length ? `(warning: ${warnings.join(", ")})` : ""].filter(Boolean).join(" ");
    console.log(`  invoice  ${`${i.supplierName} #${i.invoiceNumber}`.padEnd(34)} ${i.status.toUpperCase().padEnd(6)} ${why}`);
  }
  console.log("Next: npm run dev, then open http://localhost:3000/this-week and watch your agent pay this week's payments by itself");
}

main()
  .then(() => db().$disconnect())
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
