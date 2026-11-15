import { access, constants, mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/env";
import { connectDb } from "@/server/db";

export const dynamic = "force-dynamic";

let aiCache: { at: number; value: string } | null = null;
/** Whether the AI key is set and accepted (no secret is shown). Cached for a minute. */
async function aiStatus(): Promise<string> {
  if (!env.GROQ_API_KEY) return env.ANTHROPIC_API_KEY ? "anthropic key set (assistant needs GROQ_API_KEY)" : "off (no GROQ_API_KEY)";
  if (aiCache && Date.now() - aiCache.at < 60_000) return aiCache.value;
  let value: string;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) value = `groq key REJECTED (${r.status})`;
    else {
      const ids = ((await r.json()) as { data?: { id: string }[] }).data?.map((m) => m.id) ?? [];
      value = ids.includes(env.GROQ_TEXT_MODEL) ? "groq ok" : `groq key ok but model "${env.GROQ_TEXT_MODEL}" not found`;
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
    return Response.json({ ok: true, uploads, ai: await aiStatus() });
  } catch {
    return Response.json({ ok: false, error: "Database unreachable" }, { status: 503 });
  }
}
