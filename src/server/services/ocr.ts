import "server-only";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/env";

/**
 * Reads the printed text in a photo (menu, price list) without any AI service: Tesseract OCR running on the
 * server. Used when the AI account has no vision model. Handwriting and very blurry photos read poorly.
 */
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
    const { data } = await worker.recognize(png);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
