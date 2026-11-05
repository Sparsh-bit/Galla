import { bn } from "./bn";
import { gu } from "./gu";
import { hi } from "./hi";
import { mr } from "./mr";
import { ta } from "./ta";

// UI language. Keys are the English text itself, so untranslated text simply shows in English.
export const LANGS = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "mr", name: "मराठी" },
  { code: "gu", name: "ગુજરાતી" },
  { code: "ta", name: "தமிழ்" },
  { code: "bn", name: "বাংলা" },
] as const;
export type Lang = (typeof LANGS)[number]["code"];
export const LANG_COOKIE = "galla_lang";

const DICT: Record<Exclude<Lang, "en">, Record<string, string>> = { hi, mr, gu, ta, bn };

export const isLang = (v: unknown): v is Lang => LANGS.some((l) => l.code === v);

/** Translates `text` (English) and fills {placeholders}: t("{n} items", { n: 3 }). */
export function translate(lang: Lang, text: string, vars?: Record<string, string | number>) {
  const s = lang === "en" ? text : (DICT[lang][text] ?? text);
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}
export type T = (text: string, vars?: Record<string, string | number>) => string;
export const makeT = (lang: Lang): T => (text, vars) => translate(lang, text, vars);
