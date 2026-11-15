import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";
import { connectDb } from "@/server/db";
import { chooseModel } from "@/server/services/groq-models";

export const dynamic = "force-dynamic";

let deepCache: { at: number; value: Record<string, string> } | null = null;
/** ?deep=1: runs the real menu-reading path (text reader, then the AI) on a sample, and the assistant, and says what failed. */
async function deepAiCheck(): Promise<Record<string, string>> {
  if (deepCache && Date.now() - deepCache.at < 60_000) return deepCache.value;
  const out: Record<string, string> = {};
  try {
    const { default: sharp } = await import("sharp");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="100%" height="100%" fill="white"/><text x="40" y="100" font-size="40" font-family="Arial">Paneer Tikka Half</text><text x="680" y="100" font-size="40" font-family="Arial">180/-</text><text x="40" y="200" font-size="40" font-family="Arial">Masala Chai</text><text x="680" y="200" font-size="40" font-family="Arial">Rs. 25</text></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const t = Date.now();
    try {
      const { ocrImage } = await import("@/server/services/ocr");
      out.ocr = `ok (${Date.now() - t} ms): ${(await ocrImage(png)).replace(/\s+/g, " ").slice(0, 80)}`;
    } catch (e) {
      out.ocr = `FAILED: ${String((e as Error)?.message ?? e).slice(0, 200)}`;
    }
    const t2 = Date.now();
    try {
      const { readMenu } = await import("@/server/services/ai-menu");
      const r = await readMenu(png, "image/png");
      out.menu = `ok (${Date.now() - t2} ms): ${r.rows.map((x) => `${x.name} ${x.variant} ${x.price}`.replace(/\s+/g, " ").trim()).join("; ") || "no items"}`;
    } catch (e) {
      out.menu = `FAILED: ${String((e as Error)?.message ?? e).slice(0, 200)}`;
    }
  } catch (e) {
    out.setup = `FAILED: ${String((e as Error)?.message ?? e).slice(0, 200)}`;
  }
  deepCache = { at: Date.now(), value: out };
  return out;
}

let aiCache: { at: number; value: string } | null = null;
let aiModels: string[] = [];
/** Whether the AI key is set and accepted (no secret is shown). Cached for a minute. */
async function aiStatus(): Promise<string> {
  if (!env.GROQ_API_KEY) return env.ANTHROPIC_API_KEY ? "anthropic key set (assistant needs GROQ_API_KEY)" : "off (no GROQ_API_KEY)";
  if (aiCache && Date.now() - aiCache.at < 60_000) return aiCache.value;
  let value: string;
  try {
    const r = await fetch(`${env.GROQ_BASE_URL}/models`, { headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) value = `groq key REJECTED (${r.status})`;
    else {
      const ids = ((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
      aiModels = ids;
      const text = chooseModel(ids, env.GROQ_TEXT_MODEL, "text");
      const vision = chooseModel(ids, env.GROQ_MODEL, "vision");
      value = ids.includes(text) ? `groq ok (chat: ${text}; photos: ${vision && ids.includes(vision) ? vision : "built-in text reader (OCR)"})` : "groq key ok but no usable chat model found";
    }
  } catch {
    value = "groq unreachable";
  }
  aiCache = { at: Date.now(), value };
  return value;
}

/** Liveness + readiness for Railway/Docker health checks. Fails if MongoDB is down or not a replica set. */
export async function GET(req: Request) {
  try {
    const db = (await connectDb()).connection.db!;
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== "isdbgrid") {
      return Response.json({ ok: false, error: "MongoDB must be a replica set (transactions). Use MongoDB Atlas or start mongod with --replSet." }, { status: 503 });
    }
    // Not a failure (the app still works), but shows at a glance if photos and bills cannot be saved.
    const dir = path.resolve(env.UPLOAD_DIR);
    const uploads = await mkdir(dir, { recursive: true }).then(() => access(dir, constants.W_OK)).then(() => "writable", () => "NOT WRITABLE");
    const ai = await aiStatus();
    const deep = new URL(req.url).searchParams.get("deep") === "1" ? await deepAiCheck() : null;
    return Response.json({ ok: true, uploads, ai, ...(aiModels.length ? { aiModels } : {}), ...(deep ? { deep } : {}) }); // model names only, no secrets
  } catch {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
