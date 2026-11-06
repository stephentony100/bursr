import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { readEnv } from "./env";
import { ExtractedInvoiceSchema, type ExtractedInvoice } from "./reader-schema";
import { SAMPLE_INVOICES } from "./sample-invoices";

// The Reader: turns an invoice (image or text) into fields, using a model on
// NEAR AI Cloud (inference in a TEE). Output is validated with zod; anything
// the model is unsure of is listed in unsureFields and the invoice goes to
// "needs owner". The Reader never computes or fills in an amount.
//
// Practice mode without a key: the six sample invoices are recognised by their
// file hash. Their reading comes from fixtures/invoices/readings/ when a real
// NEAR AI reading was recorded, otherwise from lib/sample-invoices.ts (typed in
// by hand). The result always says which.

export const DEFAULT_READER_MODEL = "Qwen/Qwen3-VL-30B-A3B-Instruct"; // docs/DECISIONS.md C2

export interface InvoiceFile {
  name: string;
  mediaType: string;
  bytes: Buffer;
}

export type ReadResult =
  | { ok: true; extracted: ExtractedInvoice; readBy: string; chatId?: string }
  | { ok: false; reason: string; readBy: string };

const FIXTURES = () => path.resolve(process.cwd(), "../../fixtures/invoices");

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

const RecordedSchema = z.object({ model: z.string(), recordedAt: z.string(), chatId: z.string().optional(), extracted: ExtractedInvoiceSchema });

function sampleReading(bytes: Buffer): ReadResult | null {
  const indexFile = path.join(FIXTURES(), "index.json");
  if (!existsSync(indexFile)) return null;
  const file = (JSON.parse(readFileSync(indexFile, "utf8")) as Record<string, string>)[sha256(bytes)];
  if (!file) return null;
  const recorded = path.join(FIXTURES(), "readings", file.replace(/\.png$/, ".json"));
  if (existsSync(recorded)) {
    const r = RecordedSchema.parse(JSON.parse(readFileSync(recorded, "utf8")));
    return { ok: true, extracted: r.extracted, readBy: `NEAR AI Cloud, ${r.model} (recorded ${r.recordedAt.slice(0, 10)})`, chatId: r.chatId };
  }
  const sample = SAMPLE_INVOICES.find((s) => s.file === file);
  if (!sample) return null;
  return { ok: true, extracted: sample.printed, readBy: "Practice mode: sample invoice typed in by hand (no AI used)" };
}

const SYSTEM = [
  "You read supplier invoices for a small business.",
  "Copy every value exactly as printed. Never compute, round or fill in a number.",
  "Amounts: plain decimal numbers without currency symbols or thousands separators (e.g. 1250.00).",
  "Dates: YYYY-MM-DD, or null if not printed.",
  "payout: the payment account printed on the invoice (chain, token, address), or null if none.",
  "urgencyNote: quote any pressure or threat wording (e.g. 'pay today or…', 'bank details changed'), or null.",
  "If any field is unreadable, smudged or missing, put its name in unsureFields. Do not guess.",
].join(" ");

export async function readWithNearAi(file: InvoiceFile): Promise<ReadResult> {
  const env = readEnv();
  const model = env.NEAR_AI_MODEL ?? DEFAULT_READER_MODEL;
  const readBy = `NEAR AI Cloud, ${model}`;
  if (!env.NEAR_AI_API_KEY) {
    return { ok: false, readBy, reason: "Reading new invoices needs NEAR AI Cloud (NEAR_AI_API_KEY). In practice mode only the six sample invoices can be read." };
  }
  let content: OpenAI.Chat.Completions.ChatCompletionContentPart[];
  if (file.mediaType.startsWith("image/")) {
    content = [
      { type: "text", text: "Extract this invoice as JSON." },
      { type: "image_url", image_url: { url: `data:${file.mediaType};base64,${file.bytes.toString("base64")}` } },
    ];
  } else if (file.mediaType.startsWith("text/")) {
    content = [{ type: "text", text: `Extract this invoice as JSON.\n\n---\n${file.bytes.toString("utf8").slice(0, 20_000)}\n---` }];
  } else {
    return { ok: false, readBy, reason: "Bursar reads photos (PNG, JPG) and pasted text. For a PDF, send a photo or screenshot of it." };
  }

  const client = new OpenAI({ baseURL: env.NEAR_AI_BASE_URL, apiKey: env.NEAR_AI_API_KEY, timeout: 90_000, maxRetries: 1 });
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: { name: "invoice", schema: z.toJSONSchema(ExtractedInvoiceSchema), strict: true } },
    });
    const raw = res.choices[0]?.message?.content ?? "";
    const parsed = ExtractedInvoiceSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { ok: false, readBy, reason: `The reader's answer did not fit the invoice form (${parsed.error.issues[0]?.path.join(".")}). Enter it yourself.` };
    }
    return { ok: true, extracted: parsed.data, readBy, chatId: res.id };
  } catch (e) {
    const status = (e as { status?: number }).status;
    const why = status === 402 ? "the NEAR AI account has no credits" : e instanceof Error ? e.message : String(e);
    return { ok: false, readBy, reason: `The invoice could not be read (${why}).` };
  }
}

export async function readInvoice(file: InvoiceFile): Promise<ReadResult> {
  if (readEnv().BURSAR_MODE === "dry-run") {
    const sample = sampleReading(file.bytes);
    if (sample) return sample;
  }
  return readWithNearAi(file);
}
