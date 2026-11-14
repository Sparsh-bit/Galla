import "server-only";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { env } from "@/env";
import { AI_MAX_BYTES, AI_MAX_ROWS, type AiRow } from "@/lib/ai-menu";
import { UNITS } from "@/lib/units";
import { AppError } from "../context";

const MODEL = "claude-sonnet-5-5";
const UNIT_CODES = UNITS.map((u) => u.code);

const TOOL = {
  name: "save_items",
  description: "Save every sellable item found in the document.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Item name exactly as written, without the price, portion or category." },
            variant: { type: "string", description: "Portion or size when one item has several prices (Half, Full, Small, Large, 500 ml, 1 kg...). Empty string if none." },
            category: { type: "string", description: "The section heading the item is under (Starters, Beverages, Stationery...). Empty string if none." },
            unit: { type: "string", enum: UNIT_CODES, description: "Best unit. Food and drinks served per portion: pcs. Loose goods by weight: kg. Liquids by volume: l." },
            price: { type: ["number", "null"], description: "Selling price in rupees as printed. null if no price is shown." },
            cost: { type: ["number", "null"], description: "Cost or purchase price ONLY if the document clearly shows one. Otherwise null (menus normally have none)." },
            tax_percent: { type: ["number", "null"], description: "GST percent ONLY if printed next to the item. Otherwise null." },
          },
          required: ["name", "variant", "category", "unit", "price", "cost", "tax_percent"],
        },
      },
      note: { type: "string", description: "One short sentence about anything unclear (blurry parts, unreadable prices). Empty string if all clear." },
    },
    required: ["items", "note"],
  },
} as const;

const PROMPT = `This is a menu, price list, rate card or catalogue from an Indian shop, restaurant, salon or similar business. Read it and call save_items with every item that can be sold.
Rules:
- One entry per item and price. If an item has several prices (Half/Full, Small/Large), make one entry for each with the portion in "variant".
- Prices are in rupees. Copy numbers exactly; never guess a price. If an item has no readable price use null.
- Ignore addresses, phone numbers, offers, taxes lines, headings that are not items, and handwriting you cannot read.
- Keep the original language and spelling of names. Do not translate.
- A menu has no cost price: leave cost null unless a cost or purchase rate is clearly printed.
- At most ${AI_MAX_ROWS} items.`;

type Block = { type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const rupees = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e8 ? String(Math.round(v * 100) / 100) : "");

export const aiMenuEnabled = () => !!(env.GROQ_API_KEY || env.ANTHROPIC_API_KEY);

const RAW_ITEM = (it: Record<string, unknown>): AiRow | null => {
  const name = text(it.name, 200);
  if (!name) return null;
  const unit = typeof it.unit === "string" && UNIT_CODES.includes(it.unit) ? it.unit : "pcs";
  return { name, variant: text(it.variant, 120), category: text(it.category, 80), unit, price: rupees(it.price), cost: rupees(it.cost), tax_rate: rupees(it.tax_percent) };
};

const JSON_SHAPE = `Answer with JSON only, exactly in this shape (no other text):
{"items":[{"name":"","variant":"","category":"","unit":"pcs","price":null,"cost":null,"tax_percent":null}],"note":""}
"unit" must be one of: ${UNIT_CODES.join(", ")}. "price", "cost" and "tax_percent" are numbers or null. "note" is one short sentence about anything unclear, or "".`;

/** Groq (OpenAI-compatible): a vision model reads photos; PDFs are read as text, then structured by a text model. */
async function readWithGroq(bytes: Buffer, mime: string): Promise<{ rows: AiRow[]; note: string }> {
  let content: unknown;
  let model = env.GROQ_MODEL;
  if (mime === "application/pdf") {
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new AppError("INVALID", "That file is not a valid PDF.");
    let pdfText = "";
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      pdfText = (await extractText(pdf, { mergePages: true })).text.trim();
    } catch {
      throw new AppError("INVALID", "That PDF could not be read. Try a photo of the menu instead.");
    }
    if (pdfText.length < 20) throw new AppError("INVALID", "This PDF is a scanned picture with no text. Take a photo of the menu instead and use that.");
    model = env.GROQ_TEXT_MODEL;
    content = `${PROMPT}\n\n${JSON_SHAPE}\n\nDocument text:\n"""\n${pdfText.slice(0, 60_000)}\n"""`;
  } else {
    let jpeg: Buffer;
    try {
      jpeg = await sharp(bytes, { limitInputPixels: 120_000_000 }).rotate().resize(1800, 1800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    } catch {
      throw new AppError("INVALID", "That picture could not be read. Try another photo.");
    }
    content = [{ type: "text", text: `${PROMPT}\n\n${JSON_SHAPE}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }];
  }
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, max_tokens: 8000, response_format: { type: "json_object" }, messages: [{ role: "user", content }] }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AppError("INVALID", "The AI reader could not be reached. Check the internet and try again.");
  }
  if (!res.ok) {
    console.error("[ai-menu] Groq returned", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new AppError("INVALID", res.status === 429 ? "The AI reader is busy. Try again in a minute." : "The AI reader could not read that file. Try a clearer photo or a smaller PDF.");
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let parsed: { items?: unknown[]; note?: unknown } = {};
  try {
    parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
  } catch {
    throw new AppError("INVALID", "The AI reader gave an unreadable answer. Please try again.");
  }
  const rows = (Array.isArray(parsed.items) ? parsed.items.slice(0, AI_MAX_ROWS) : []).map((it) => RAW_ITEM(it as Record<string, unknown>)).filter((r): r is AiRow => !!r);
  return { rows, note: text(parsed.note, 300) };
}

/** Reads a menu photo or PDF and returns draft product rows to review (nothing is saved here). */
export async function readMenu(bytes: Buffer, mime: string): Promise<{ rows: AiRow[]; note: string }> {
  if (!aiMenuEnabled()) throw new AppError("INVALID", "Adding products from a photo or PDF is not switched on for this server yet. Ask Concilio Solutions to enable it.");
  if (bytes.length > AI_MAX_BYTES) throw new AppError("INVALID", "That file is too large. Use a file under 12 MB.");
  if (env.GROQ_API_KEY) return readWithGroq(bytes, mime);
  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new AppError("INVALID", "The AI reader is not set up.");

  let block: Block;
  if (mime === "application/pdf") {
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new AppError("INVALID", "That file is not a valid PDF.");
    block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } };
  } else {
    // Straighten and shrink the photo: sharper text reads better than a huge file.
    let jpeg: Buffer;
    try {
      jpeg = await sharp(bytes, { limitInputPixels: 120_000_000 }).rotate().resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      throw new AppError("INVALID", "That picture could not be read. Try another photo.");
    }
    block = { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } };
  }

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AppError("INVALID", "The AI reader could not be reached. Check the internet and try again.");
  }
  if (!res.ok) {
    console.error("[ai-menu] Anthropic returned", res.status, (await res.text().catch(() => "")).slice(0, 300));
    throw new AppError("INVALID", res.status === 429 ? "The AI reader is busy. Try again in a minute." : "The AI reader could not read that file. Try a clearer photo or a smaller PDF.");
  }
  const json = (await res.json()) as { content?: { type: string; input?: { items?: unknown[]; note?: unknown } }[] };
  const input = json.content?.find((b) => b.type === "tool_use")?.input;
  const items = Array.isArray(input?.items) ? input.items.slice(0, AI_MAX_ROWS) : [];
  const rows: AiRow[] = [];
  for (const it of items as Record<string, unknown>[]) {
    const name = text(it.name, 200);
    if (!name) continue;
    const unit = typeof it.unit === "string" && UNIT_CODES.includes(it.unit) ? it.unit : "pcs";
    rows.push({ name, variant: text(it.variant, 120), category: text(it.category, 80), unit, price: rupees(it.price), cost: rupees(it.cost), tax_rate: rupees(it.tax_percent) });
  }
  return { rows, note: text(input?.note, 300) };
}
