import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";
import { connectDb } from "@/server/db";
import { chooseModel } from "@/server/services/groq-models";

export const dynamic = "force-dynamic";

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
export async function GET() {
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
    return Response.json({ ok: true, uploads, ai, ...(aiModels.length ? { aiModels } : {}) }); // model names only, no secrets
  } catch {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
