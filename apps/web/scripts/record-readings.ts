// npm run readings:record: reads the six sample invoices with NEAR AI Cloud
// (needs NEAR_AI_API_KEY with credits) and saves each reading in
// fixtures/invoices/readings/. Practice mode then shows these real readings
// instead of the hand-typed ones. Prints any field where the model read
// something different from what is printed on the invoice.
import "./load-env";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { readEnv } from "../lib/env";
import { DEFAULT_READER_MODEL, readWithNearAi } from "../lib/reader";
import { SAMPLE_INVOICES } from "../lib/sample-invoices";

const dir = path.resolve(process.cwd(), "../../fixtures/invoices");
mkdirSync(path.join(dir, "readings"), { recursive: true });
const model = readEnv().NEAR_AI_MODEL ?? DEFAULT_READER_MODEL;
let differences = 0;

for (const s of SAMPLE_INVOICES) {
  const r = await readWithNearAi({ name: s.file, mediaType: "image/png", bytes: readFileSync(path.join(dir, s.file)) });
  if (!r.ok) {
    console.error(`FAILED ${s.file}: ${r.reason}`);
    process.exit(1);
  }
  for (const key of Object.keys(s.printed) as (keyof typeof s.printed)[]) {
    if (!isDeepStrictEqual(r.extracted[key], s.printed[key])) {
      differences++;
      console.log(`  ${s.file} ${key}: printed ${JSON.stringify(s.printed[key])}, model read ${JSON.stringify(r.extracted[key])}`);
    }
  }
  const out = { model, recordedAt: new Date().toISOString(), chatId: r.chatId, extracted: r.extracted };
  writeFileSync(path.join(dir, "readings", s.file.replace(/\.png$/, ".json")), JSON.stringify(out, null, 2) + "\n");
  console.log(`recorded ${s.file}`);
}
console.log(differences ? `\n${differences} field(s) differ from the printed invoices (see above). Run npm test to see the effect on the checks.` : "\nEvery field matches the printed invoices.");
