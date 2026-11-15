import "server-only";
import sharp from "sharp";
import { extractText, getDocumentProxy } from "unpdf";
import { env } from "@/env";
import { AI_MAX_BYTES, AI_MAX_ROWS, type AiRow } from "@/lib/ai-menu";
import { UNITS } from "@/lib/units";
import { AppError } from "../context";
import { groqTextModel, groqVisionModel, stripThinking } from "./groq-models";
import { ocrImage } from "./ocr";

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
- Prices are in rupees. They may be written 180, 180/-, Rs. 180, ₹180 or 180.00. Copy numbers exactly; never guess a price. If an item has no readable price use null.
- A row may carry several prices under headings like Half/Full or S/M/L (e.g. "Paneer Tikka | 180 | 320"): make one entry per price, matching the headings in order.
- Rows read from a photo may show columns separated by " | ": the number at the end of an item's row is normally its price.
- Ignore addresses, phone numbers, offers, taxes lines, headings that are not items, and handwriting you cannot read.
- Keep the original language and spelling of names. Do not translate.
- A menu has no cost price: leave cost null unless a cost or purchase rate is clearly printed.
- At most ${AI_MAX_ROWS} items.`;

type Block = { type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const rupees = (v: unknown) => {
  // The model sometimes returns "₹180" or "180/-" as text: take the number out of it.
  const n = typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n < 1e8 && (typeof v !== "string" || /\d/.test(v)) ? String(Math.round(n * 100) / 100) : "";
};

/** The JSON object in a model reply, even when it is wrapped in text or code fences. */
export function parseJsonObject(raw: string): { items?: unknown[]; note?: unknown } {
  const t = raw.replace(/```(?:json)?/gi, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? t.slice(start, end + 1) : t);
}

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
  let model = (await groqVisionModel()) ?? "";
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
    model = await groqTextModel();
    content = `${PROMPT}\n\n${JSON_SHAPE}\n\nDocument text:\n"""\n${pdfText.slice(0, 60_000)}\n"""`;
  } else if (!model) {
    // No vision model on this AI account: read the text off the photo ourselves, then let the chat model structure it.
    let photoText = "";
    try {
      photoText = await ocrImage(bytes);
    } catch (e) {
      console.error("[ai-menu] OCR failed", e);
      throw new AppError("INVALID", `The text reader could not open that photo (${String((e as Error)?.message ?? e).slice(0, 120)}). Try another photo.`);
    }
    if (photoText.length < 15) throw new AppError("INVALID", "No readable text was found in that photo. Try a closer, brighter, straighter photo of a printed menu.");
    model = await groqTextModel();
    content = `${PROMPT}\nThe text below was read from a PHOTO by an automatic text reader, so it may contain small mistakes (e.g. O for 0) and mixed-up columns: use the layout and common sense to pair each item with its price, and put anything doubtful in "note".\n\n${JSON_SHAPE}\n\nPhoto text:\n"""\n${photoText.slice(0, 60_000)}\n"""`;
  } else {
    let jpeg: Buffer;
    try {
      jpeg = await sharp(bytes, { limitInputPixels: 120_000_000 }).rotate().resize(1800, 1800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    } catch {
      throw new AppError("INVALID", "That picture could not be read. Try another photo.");
    }
    content = [{ type: "text", text: `${PROMPT}\n\n${JSON_SHAPE}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${jpeg.toString("base64")}` } }];
  }
  // Some Groq models reject JSON mode (400): then ask again without it and pull the JSON out of the reply.
  const ask = async (jsonMode: boolean) => {
    try {
      return await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ model, temperature: 0, max_tokens: 8000, ...(jsonMode ? { response_format: { type: "json_object" } } : {}), messages: [{ role: "user", content }] }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new AppError("INVALID", "The AI reader could not be reached. Check the internet and try again.");
    }
  };
  let res = await ask(true);
  if (res.status === 400) {
    console.warn("[ai-menu] Groq rejected JSON mode, retrying without it:", (await res.text().catch(() => "")).slice(0, 200));
    res = await ask(false);
  }
  if (!res.ok) {
    const why = (await res.text().catch(() => "")).slice(0, 300);
    console.error("[ai-menu] Groq returned", res.status, why);
    if (res.status === 401 || res.status === 403) throw new AppError("INVALID", "The AI key was refused. Ask Concilio Solutions to check GROQ_API_KEY.");
    if (res.status === 429) throw new AppError("INVALID", "The AI reader is busy. Try again in a minute.");
    throw new AppError("INVALID", `The AI reader could not read that file (AI error ${res.status}${/model/i.test(why) ? ": model problem" : ""}). Try a clearer photo or a smaller PDF.`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let parsed: { items?: unknown[]; note?: unknown } = {};
  try {
    parsed = parseJsonObject(stripThinking(json.choices?.[0]?.message?.content ?? "{}"));
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
