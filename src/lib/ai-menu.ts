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
