// Smoke test for NEAR AI Cloud.
// Without a key: lists models (public endpoint) and checks the chosen model
// reads images. With NEAR_AI_API_KEY: renders the sample invoice to PNG and
// extracts it into the Reader schema, validated with zod.
import "./load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";
import { readEnv } from "../lib/env";
import { fetchJson } from "../lib/http";
import { ExtractedInvoiceSchema } from "../lib/reader-schema";

const DEFAULT_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct"; // see docs/DECISIONS.md

const ModelsSchema = z.object({
  data: z.array(
    z.looseObject({
      id: z.string(),
      input_modalities: z.array(z.string()).optional(),
      supported_features: z.array(z.string()).optional(),
    }),
  ),
});

async function main() {
  const env = readEnv();
  const model = env.NEAR_AI_MODEL ?? DEFAULT_MODEL;
  const base = env.NEAR_AI_BASE_URL.replace(/\/$/, "");

  const models = await fetchJson(`${base}/models`, ModelsSchema);
  const m = models.data.find((x) => x.id === model);
  if (!m) throw new Error(`model ${model} is not in GET /v1/models`);
  console.log(`GET /v1/models → ${models.data.length} models; ${model}:`);
  console.log(`  input: ${m.input_modalities?.join(", ") ?? "?"}  features: ${m.supported_features?.join(", ") ?? "?"}`);
  if (!m.input_modalities?.includes("image")) throw new Error(`${model} does not list image input`);

  if (!env.NEAR_AI_API_KEY) {
    console.log("\nSKIPPED extraction: set NEAR_AI_API_KEY in .env to run it (dry-run never needs it).");
    return;
  }

  const svg = await readFile(path.resolve(process.cwd(), "../../fixtures/invoices/smoke-invoice.svg"));
  const png = await sharp(svg).png().toBuffer();
  const client = new OpenAI({ baseURL: base, apiKey: env.NEAR_AI_API_KEY, timeout: 60_000 });

  const started = Date.now();
  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You read supplier invoices. Copy values exactly as printed. Never compute or guess a number. " +
          "If a field is unreadable or missing, list its name in unsureFields.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract this invoice as JSON." },
          { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}` } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "invoice", schema: z.toJSONSchema(ExtractedInvoiceSchema), strict: true },
    },
  });

  const raw = res.choices[0]?.message?.content ?? "";
  const parsed = ExtractedInvoiceSchema.safeParse(JSON.parse(raw));
  console.log(`\nchat id ${res.id} in ${Date.now() - started} ms`);
  if (!parsed.success) {
    console.error("Model output failed zod validation:\n", raw, "\n", parsed.error.issues);
    process.exit(1);
  }
  console.log(JSON.stringify(parsed.data, null, 2));
  console.log("\nOK: structured extraction validated with zod.");
}

main().catch((e) => {
  if ((e as { status?: number }).status === 402) {
    console.error("FAILED: NEAR AI Cloud accepted the key but the account has no credits (402). Add credits at cloud.near.ai.");
    process.exit(1);
  }
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
