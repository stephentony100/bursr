// Draws the six sample invoices (fixtures/invoices/*.png) from lib/sample-invoices.ts
// and writes fixtures/invoices/index.json: the sha256 of each image, so the
// practice-mode Reader can recognise them. Run once; the outputs are committed.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { invoiceSvg } from "../lib/invoice-art";
import { SAMPLE_NAME } from "../lib/sample";
import { SAMPLE_INVOICES } from "../lib/sample-invoices";

const dir = path.resolve(process.cwd(), "../../fixtures/invoices");
mkdirSync(dir, { recursive: true });
const index: Record<string, string> = {};
for (const s of SAMPLE_INVOICES) {
  const png = await sharp(Buffer.from(invoiceSvg(s, SAMPLE_NAME))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(path.join(dir, s.file), png);
  index[createHash("sha256").update(png).digest("hex")] = s.file;
  console.log(`${s.file}  ${(png.length / 1024).toFixed(0)} KB`);
}
writeFileSync(path.join(dir, "index.json"), JSON.stringify(index, null, 2) + "\n");
console.log("wrote index.json");
