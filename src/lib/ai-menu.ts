/** One row of an AI-read menu or price list, in the same units as the import template (prices in rupees, as text). */
export interface AiRow {
  name: string;
  variant: string;
  category: string;
  unit: string;
  price: string;
  cost: string;
  tax_rate: string;
}

export const AI_MAX_ROWS = 300;
export const AI_MAX_BYTES = 12 * 1024 * 1024;
export const AI_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/**
 * False for text that is not a real product name: unreadable scraps from a photo ("0oood", "||--", "x"). Such lines
 * are never offered or added; the owner only sees items that were actually identified.
 */
export function looksLikeProductName(name: string): boolean {
  const t = name.trim();
  const chars = [...t.replace(/\s+/g, "")];
  if (chars.length < 2) return false;
  const letters = chars.filter((c) => /\p{L}/u.test(c)).length;
  if (letters < 2 || letters / chars.length < 0.5) return false; // mostly digits or symbols
  if (new Set(chars.map((c) => c.toLowerCase())).size <= 1) return false; // "aaaa"
  // One character making up most of a longer word is a scrap from an unreadable photo ("0oood"), not a name.
  const counts = new Map<string, number>();
  for (const c of chars) counts.set(c.toLowerCase(), (counts.get(c.toLowerCase()) ?? 0) + 1);
  if (chars.length >= 5 && Math.max(...counts.values()) / chars.length >= 0.6) return false;
  return true;
}
