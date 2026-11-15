import "server-only";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/env";

/**
 * Reads the printed text in a photo (menu, price list) without any AI service: Tesseract OCR running on the
 * server. Used when the AI account has no vision model. Handwriting and very blurry photos read poorly.
 */
type Word = { text: string; x0: number; x1: number; y0: number; y1: number; conf: number };

// tesseract.js returns words inside blocks > paragraphs > lines; walk it without depending on the exact version.
function flattenWords(data: unknown): Word[] {
  const out: Word[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as Record<string, unknown>;
    if (typeof o.text === "string" && o.bbox && typeof (o.bbox as { x0?: unknown }).x0 === "number" && !("words" in o) && !("lines" in o) && !("paragraphs" in o)) {
      const b = o.bbox as { x0: number; x1: number; y0: number; y1: number };
      out.push({ text: o.text, ...b, conf: Number(o.confidence ?? 100) });
      return;
    }
    for (const k of ["blocks", "paragraphs", "lines", "words"]) if (Array.isArray(o[k])) (o[k] as unknown[]).forEach(walk);
  };
  walk(data);
  return out;
}

/** Puts words that sit on the same row back on one line (left to right), with a visible gap between columns. */
export function linesFromWords(words: Word[]): string {
  const ws = words.filter((w) => w.text.trim() && w.conf >= 25).sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  if (!ws.length) return "";
  const heights = ws.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const h = heights[Math.floor(heights.length / 2)] || 20;
  const rows: Word[][] = [];
  for (const w of ws) {
    const cy = (w.y0 + w.y1) / 2;
    const row = rows.find((r) => Math.abs(r.reduce((a, x) => a + (x.y0 + x.y1) / 2, 0) / r.length - cy) < h * 0.6);
    if (row) row.push(w);
    else rows.push([w]);
  }
  return rows
    .sort((a, b) => a[0].y0 - b[0].y0)
    .map((r) => {
      r.sort((a, b) => a.x0 - b.x0);
      return r.map((w, i) => (i === 0 ? w.text : `${w.x0 - r[i - 1].x1 > h * 2.5 ? "   |   " : " "}${w.text}`)).join("");
    })
    .join("\n");
}

export async function ocrImage(bytes: Buffer): Promise<string> {
  // Straighten, upscale a little, and make it high-contrast greyscale: OCR is much more accurate that way.
  const png = await sharp(bytes, { limitInputPixels: 120_000_000 })
    .rotate()
    .resize(2600, 2600, { fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
  const { createWorker } = await import("tesseract.js");
  // Language data is downloaded once and kept in the temp folder.
  const worker = await createWorker(env.OCR_LANGS, 1, { cachePath: path.join(os.tmpdir(), "galla-tesseract") });
  try {
    // Sparse-text layout analysis keeps menu rows (name ........ price) as rows instead of reading column by column.
    await worker.setParameters({ tessedit_pageseg_mode: "11" as never });
    const { data } = await worker.recognize(png, {}, { blocks: true });
    const words = flattenWords(data);
    return words.length ? linesFromWords(words) : data.text.trim();
  } finally {
    await worker.terminate();
  }
}
