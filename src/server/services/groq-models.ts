import "server-only";
import { env } from "@/env";

// Groq retires and renames models. Instead of trusting one hard-coded name, ask Groq what it offers and
// use the configured model if it exists, otherwise the best available one. A list that cannot be read
// falls back to the configured name (the request then reports its own error).

const NOT_CHAT = /(whisper|guard|tts|playai|embed|safeguard|orpheus|transcribe)/i;
const TEXT_PREFERENCE = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3-32b", "llama-3.1-8b-instant"];
const TEXT_ANY = /(llama|gpt-oss|qwen|kimi|mixtral|gemma|deepseek)/i;
const VISION_ANY = /(llama-4|vision|scout|maverick)/i;

let cache: { at: number; key: string; ids: string[] | null } | null = null;

export async function groqModelIds(): Promise<string[] | null> {
  const key = env.GROQ_API_KEY;
  if (!key) return null;
  if (cache && cache.key === key && Date.now() - cache.at < 10 * 60_000) return cache.ids;
  let ids: string[] | null = null;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const list = ((await r.json()) as { data?: { id?: string }[] }).data;
      if (Array.isArray(list)) ids = list.map((m) => String(m.id ?? "")).filter(Boolean);
    }
  } catch {
    /* unreachable: use the configured model */
  }
  cache = { at: Date.now(), key, ids };
  return ids;
}

/** Pure choice, easy to test. */
export function chooseModel(ids: string[] | null, configured: string, kind: "text" | "vision"): string {
  if (!ids) return configured;
  if (ids.includes(configured)) return configured;
  const usable = ids.filter((i) => !NOT_CHAT.test(i));
  if (kind === "vision") return usable.find((i) => VISION_ANY.test(i)) ?? "";
  return TEXT_PREFERENCE.find((p) => usable.includes(p)) ?? usable.find((i) => TEXT_ANY.test(i)) ?? configured;
}

export async function groqTextModel() {
  return chooseModel(await groqModelIds(), env.GROQ_TEXT_MODEL, "text");
}
/** A vision model, or null when the account has none (photos are then read with the built-in text reader). */
export async function groqVisionModel(): Promise<string | null> {
  return chooseModel(await groqModelIds(), env.GROQ_MODEL, "vision") || null;
}

/** Some reasoning models put their thinking in <think> tags: show only the answer. */
export const stripThinking = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
